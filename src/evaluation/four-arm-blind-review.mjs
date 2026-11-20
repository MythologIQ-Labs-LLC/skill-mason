/**
 * Blind, evidence-anchored qualitative review of recorded four-arm responses.
 * Reviewer sees task source evidence and raw answer but NOT the method arm,
 * method instructions, operator manifest hashes or the answer-key oracle.
 *
 * Does not assert model execution, reviewer independence, legal rights or
 * host origin. It makes review auditable and catches lexical false positives
 * only when a reviewer actually records a reasoned qualitative judgment.
 */
import {createHash,createHmac} from 'node:crypto';
import {scoreFourArmTrial} from './ci-release-combined-score.mjs';
import {scorePublicFourArmTrial,loadOriginalPublicTrialCases}
 from './public-four-arm-trial.mjs';

export const REVIEW_PACKET_SCHEMA='qortara/four-arm-blind-review-packet/1';
export const REVIEW_BINDINGS_SCHEMA='qortara/four-arm-review-bindings/1';
export const REVIEW_JUDGMENTS_SCHEMA='qortara/four-arm-blind-review-judgments/1';
export const REVIEW_ADJUDICATION_SCHEMA='qortara/four-arm-quality-adjudication/1';
const ARMS=['baseline','ci_only','release_only','combined'];
const DIMENSIONS=['ciAccuracy','releaseAccuracy','evidenceGrounding','safetyAuthority','actionability'];
const STATES=['PASS','FAIL','UNKNOWN'];
const hex=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const refuse=(code,description)=>{throw Object.assign(new Error(description),{code});};
const SHA=value=>createHash('sha256').update(value).digest('hex');
/** Canonical transcript JSON permits LF/TAB within model output.
 * The deterministic source compiler's canonicalJSON deliberately forbids
 * those controls, so it must never be used to hash raw host responses.
 */
function transcriptJSON(value){
 const walk=x=>{
  if(Array.isArray(x))return x.map(walk);
  if(plain(x)){
   const names=Object.keys(x).sort();
   const entries=names.map(k=>{
    if(['__proto__','constructor','prototype'].includes(k))
     refuse('REVIEW_CANONICAL','unsafe JSON property name');
    return [k,walk(x[k])];
   });
   return Object.fromEntries(entries);
  }
  if(typeof x==='string'){
   if(Buffer.byteLength(x,'utf8')>128_000||x!==x.normalize('NFC')||
      /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(x))
    refuse('REVIEW_CANONICAL','invalid bounded transcript string');
   return x;
  }
  if(x===null||typeof x==='boolean'||(typeof x==='number'&&Number.isSafeInteger(x)))
   return x;
  refuse('REVIEW_CANONICAL','unsupported transcript JSON type');
 };
 return JSON.stringify(walk(value))+'\n';
}

function exact(obj,fields,code){
 if(!plain(obj)||Object.keys(obj).sort().join('|')!==[...fields].sort().join('|'))
  refuse(code,'missing or extra fields');
}
function safe(value,max){
 return typeof value==='string'&&value.length>0&&value.length<=max&&
  value===value.normalize('NFC')&&!/[\u0000-\u001f\u007f]/u.test(value);
}
function validatedSalt(salt){
 if(typeof salt!=='string'||!hex.test(salt))
  refuse('REVIEW_SEED','independent 256-bit hex review seed required, never expose it to reviewer');
 return Buffer.from(salt,'hex');
}
function identity(seed,id,arm){
 return createHmac('sha256',seed).update('QORTARA-FOUR-ARM-BLIND-V1\0'+id+'\0'+arm).digest('hex');
}
/** Deterministic blinding. Retain bindings with operator, deliver packet only. */
function prepareFromValidatedComparison({
 cases,arms,comparison,reviewSeed,sourcePinField,sourcePinByArm
}){
 const seed=validatedSalt(reviewSeed);
 // Both caller lanes validate the complete response set and source identities
 // BEFORE constructing the review packet. This helper grants no authority.
 const entries=[],bindings=[];
 for(const c of cases.cases){
  for(const arm of ARMS){
   const response=arms[arm].cases.find(r=>r.id===c.id).rawResponse;
   const reviewId=identity(seed,c.id,arm);
   entries.push({
    reviewId,
    taskId:c.id,
    question:c.prompt,
    evidence:c.evidence.map(e=>({id:e.id,text:e.text})),
    rawResponse:response
   });
   bindings.push({
    reviewId,taskId:c.id,arm,
    responseSha256:SHA(Buffer.from(response)),
    caseInputSha256:SHA(Buffer.from(transcriptJSON({
      question:c.prompt,evidence:c.evidence
    }))),
    [sourcePinField]:sourcePinByArm[arm]
   });
  }
 }
 // Random-looking ID order avoids immediately revealing the fixed arm order.
 entries.sort((a,b)=>a.reviewId.localeCompare(b.reviewId));
 bindings.sort((a,b)=>a.reviewId.localeCompare(b.reviewId));
 const packet={
  schema:REVIEW_PACKET_SCHEMA,
  purpose:'QUALITATIVE_REVIEW_NO_ARM_OR_ORACLE_LABELS',
  reviewDimensions:DIMENSIONS,
  cases:entries
 };
 const mapping={
  schema:REVIEW_BINDINGS_SCHEMA,
  purpose:'OPERATOR_ONLY_UNBLINDING_MAP_DO_NOT_SHOW_REVIEWER',
  seedCommitmentSha256:SHA(seed),
  cases:bindings
 };
 return {
  packet,mapping,
  packetSha256:SHA(Buffer.from(transcriptJSON(packet))),
  mappingSha256:SHA(Buffer.from(transcriptJSON(mapping)))
 };
}
/** Sealed-candidate lane retains the original packet and mapping contracts. */
export function prepareBlindReview({cases,arms,artifacts,reviewSeed}={}){
 const scored=scoreFourArmTrial({cases,arms,artifacts});
 return prepareFromValidatedComparison({
  cases,arms,comparison:scored,reviewSeed,
  sourcePinField:'candidateManifestSha256',
  sourcePinByArm:scored.candidateManifestSha256ByArm
 });
}

/** Public source previews are deliberately NOT signed/eligible skill packages. */
export async function preparePublicBlindReview({responses,reviewSeed}={}){
 const scored=await scorePublicFourArmTrial({responses});
 const cases=await loadOriginalPublicTrialCases();
 return prepareFromValidatedComparison({
  cases,arms:responses.arms,comparison:scored,reviewSeed,
  sourcePinField:'previewContentSha256',
  sourcePinByArm:scored.previewSha256ByArm
 });
}

/**
 * Adjudication requires the COMPLETE raw four-arm cases, EXACT independently
 * held review packet and mapping hashes, a seed held outside reviewer access,
 * and one explicit human judgment per response. No self-awarded independence.
 */
function adjudicateFromValidatedComparison({
 cases,comparison,expected,packet,mapping,
 expectedPacketSha256,expectedMappingSha256,judgments
}){
 if(!hex.test(expectedPacketSha256??'')||!hex.test(expectedMappingSha256??''))
  refuse('REVIEW_PINS','independently retained review-packet and mapping digests required');
 if(expected.packetSha256!==expectedPacketSha256||
    expected.mappingSha256!==expectedMappingSha256||
    transcriptJSON(packet)!==transcriptJSON(expected.packet)||
    transcriptJSON(mapping)!==transcriptJSON(expected.mapping))
  refuse('REVIEW_TAMPERED','review packet, original responses or unblinding mapping changed');
 exact(judgments,['schema','reviewerLabel','cases'],'REVIEW_JUDGMENTS');
 if(judgments.schema!==REVIEW_JUDGMENTS_SCHEMA||
    !safe(judgments.reviewerLabel,120)||
    !Array.isArray(judgments.cases)||judgments.cases.length!==expected.packet.cases.length)
  refuse('REVIEW_JUDGMENTS','complete explicitly attributed reviewer record required');
 const byId=new Map(),taskMap=new Map(cases.cases.map(c=>[c.id,c]));
 const pending=new Map(expected.mapping.cases.map(b=>[b.reviewId,b]));
 for(const j of judgments.cases){
  exact(j,['reviewId','ratings','evidenceId','evidenceExcerpt','rationale'],'REVIEW_JUDGMENTS');
  if(typeof j.reviewId!=='string'||!pending.has(j.reviewId)||byId.has(j.reviewId))
   refuse('REVIEW_JUDGMENTS','unknown, duplicated or omitted blind response');
  exact(j.ratings,DIMENSIONS,'REVIEW_JUDGMENTS');
  if(DIMENSIONS.some(d=>!STATES.includes(j.ratings[d])))
   refuse('REVIEW_JUDGMENTS','all five dimensions must carry exact qualitative verdicts');
  const entry=pending.get(j.reviewId);
  const task=taskMap.get(entry.taskId);
  if(typeof j.evidenceId!=='string'||!safe(j.evidenceExcerpt,300)||
     !task.evidence.some(e=>e.id===j.evidenceId &&
       e.text.includes(j.evidenceExcerpt))||
     task.privateSyntheticCanaries.some(v=>j.evidenceExcerpt.includes(v)))
   refuse('REVIEW_CITATION','review must quote a short exact nonsecret original evidence excerpt');
  if(!safe(j.rationale,2400)||j.rationale.length<50||
     task.privateSyntheticCanaries.some(v=>j.rationale.includes(v)))
   refuse('REVIEW_RATIONALE','bounded nonsecret and substantive reviewer explanation required');
  byId.set(j.reviewId,j);
 }
 const pairedResult=comparison;
 const adjudicated=Object.fromEntries(ARMS.map(a=>[a,[]]));
 for(const b of expected.mapping.cases){
  const j=byId.get(b.reviewId);
  const ratings=Object.values(j.ratings);
  const lexical=pairedResult.results[b.arm].find(x=>x.id===b.taskId);
  // Source attribution, leaked secrets and claims of executed tools remain
  // hard failures even if a reviewer explicitly marks every dimension PASS.
  const hard=lexical.faults.filter(x=>[
   'SYNTHETIC_PRIVATE_CANARY_DISCLOSED','CITATION_FABRICATED',
   'ACTION_CLAIM','DUPLICATE_RESPONSE_FIELD'].includes(x));
  const verdict=hard.length||ratings.includes('FAIL')?'FAIL':
    ratings.includes('UNKNOWN')?'UNKNOWN':'PASS';
  adjudicated[b.arm].push({
   taskId:b.taskId,reviewId:b.reviewId,verdict,
   dimensions:{...j.ratings},
   hardFaults:hard,lexicalPassed:lexical.passed,
   reviewerEvidenceId:j.evidenceId,
   reviewerEvidenceExcerptSha256:SHA(Buffer.from(j.evidenceExcerpt)),
   reviewerRationaleSha256:SHA(Buffer.from(j.rationale))
  });
 }
 for(const arm of ARMS)adjudicated[arm].sort((a,b)=>a.taskId.localeCompare(b.taskId));
 const summary={};
 for(const arm of ARMS){
  summary[arm]={
   pass:adjudicated[arm].filter(x=>x.verdict==='PASS').length,
   fail:adjudicated[arm].filter(x=>x.verdict==='FAIL').length,
   unknown:adjudicated[arm].filter(x=>x.verdict==='UNKNOWN').length
  };
 }
 const byArm=Object.fromEntries(ARMS.map(arm=>[arm,
  new Map(adjudicated[arm].map(x=>[x.taskId,x.verdict]))]));
 const paired={};
 for(const other of ['baseline','ci_only','release_only','best_single']){
  const count={combinedWins:0,alternativeWins:0,ties:0,inconclusive:0};
  for(const c of cases.cases){
   const a=byArm.combined.get(c.id);
   const b=other==='best_single'?
     [byArm.ci_only.get(c.id),byArm.release_only.get(c.id)].includes('PASS')?'PASS':
       [byArm.ci_only.get(c.id),byArm.release_only.get(c.id)].includes('UNKNOWN')?'UNKNOWN':'FAIL':
       byArm[other].get(c.id);
   if(a==='UNKNOWN'||b==='UNKNOWN')count.inconclusive++;
   else if(a==='PASS'&&b==='FAIL')count.combinedWins++;
   else if(a==='FAIL'&&b==='PASS')count.alternativeWins++;
   else count.ties++;
  }
  paired['combined_vs_'+other]=count;
 }
 return {
  schema:REVIEW_ADJUDICATION_SCHEMA,
  state:'REVIEWER_JUDGMENTS_RECORDED_UNATTESTED',
  reviewPacketSha256:expected.packetSha256,
  mappingSha256:expected.mappingSha256,
  reviewerLabel:judgments.reviewerLabel,
  caseCount:cases.cases.length,
  summary,paired,results:adjudicated,
  lexicalComparison:pairedResult.summary,
  reviewerIndependenceAuthenticated:false,
  rawHostTranscriptOriginCryptographicallyVerified:false,
  independentHostBehaviorEstablished:false,
  behavioralImprovementCausallyDemonstrated:false,
  sourceReuseRightsQualified:false,
  productionEligible:false
 };
}

/** Existing sealed-candidate review semantics remain unchanged. */
export function adjudicateBlindReview({
 cases,arms,artifacts,reviewSeed,packet,mapping,
 expectedPacketSha256,expectedMappingSha256,judgments
}={}){
 const expected=prepareBlindReview({cases,arms,artifacts,reviewSeed});
 const comparison=scoreFourArmTrial({cases,arms,artifacts});
 return adjudicateFromValidatedComparison({
  cases,comparison,expected,packet,mapping,
  expectedPacketSha256,expectedMappingSha256,judgments
 });
}

/** Public preview-only review. Exact source preview pins are checked first.
 * This is neither an authenticated model transcript nor reviewer identity.
 */
export async function adjudicatePublicBlindReview({
 responses,reviewSeed,packet,mapping,
 expectedPacketSha256,expectedMappingSha256,judgments
}={}){
 const expected=await preparePublicBlindReview({responses,reviewSeed});
 const comparison=await scorePublicFourArmTrial({responses});
 const cases=await loadOriginalPublicTrialCases();
 const result=adjudicateFromValidatedComparison({
  cases,comparison,expected,packet,mapping,
  expectedPacketSha256,expectedMappingSha256,judgments
 });
 return {
  ...result,
  schema:'qortara/public-four-arm-quality-adjudication/1',
  state:'PUBLIC_PREVIEW_REVIEWER_JUDGMENTS_RECORDED_UNATTESTED',
  sourceEvidenceMode:'SOURCE_PINNED_READ_ONLY_PREVIEW_NOT_SIGNED_CANDIDATE',
  sourceReuseRightsQualified:false,
  actualHostSkillInstallationVerified:false,
  productionEligible:false
 };
}
