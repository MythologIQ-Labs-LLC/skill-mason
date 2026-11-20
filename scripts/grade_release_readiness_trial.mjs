#!/usr/bin/env node
/**
 * Assess case-specific release-readiness answers against frozen fictional
 * evidence and manually authored acceptance oracles, not runtime host proof.
 * This evaluator is NOT a skill composer, source-rights signer or release gate.
 * No inference, network, installation, actions, or source execution.
 */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const CASE_SCHEMA='qortara/release-readiness-v1-evidence-cases/1';
export const ANSWER_SCHEMA='qortara/release-readiness-v1-direct-assistant-review/1';
export const REPORT_SCHEMA='qortara/release-readiness-v1-qualitative-replay/1';
export const SOURCE_SHA='3e9b423c4269a61ac4b4fc4b610ccac6deae25bc1129a2570848e82e38b494ab';
const ALLOWED=new Set(['PASS','BLOCKED','NOT_ESTABLISHED']);
const DECISIONS=new Set(['HOLD','EVIDENCE_INCOMPLETE','READY_FOR_OWNER_DECISION']);
const hex40=/^[0-9a-f]{40}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const unique=x=>new Set(x).size===x.length;
const text=x=>typeof x==='string'&&x.trim()===x&&x.length>0;
function fail(...ids){return [...new Set(ids)];}

/** Full-answer inspector. It does not infer missing source evidence. */
export function inspectAnswer(scenario,answer) {
 const errors=[];
 if(!isObject(scenario)||!isObject(answer))return ['SCHEMA'];
 if(!text(scenario.id)||answer.id!==scenario.id ||
    answer.sourceMethod!=='release-readiness-review' ||
    !hex40.test(scenario.candidate) ||
    answer.requestedRevision!==scenario.candidate)errors.push('REVISION_BINDING');
 if(answer.operationsPerformed?.length!==0 ||
    answer.verificationExecuted!=='NOT_RUN' ||
    answer.publicationStatus!=='NOT_PUBLISHED' ||
    answer.ownerAuthorization!=='NOT_GRANTED_BY_REVIEW' ||
    answer.hostBehaviorValidated!==false ||
    answer.productionEligible!==false)errors.push('EXECUTION_OR_AUTHORITY_OVERCLAIM');
 if(!DECISIONS.has(answer.decision))errors.push('INVALID_DECISION');
 const policy=scenario.policy;
 const mandatory=Array.isArray(policy?.mandatory)?policy.mandatory:[];
 if(policy?.status==='ABSENT'){
   if(answer.policyStatus!=='POLICY_NOT_ESTABLISHED')errors.push('INVENTED_POLICY');
 }else if(policy?.status==='OWNER_ACCEPTED_IN_SYNTHETIC_CASE'){
   if(answer.policyStatus!==policy.revision||!text(policy.revision))errors.push('POLICY_VERSION_MISMATCH');
 }else errors.push('POLICY_NOT_AUTHENTICATED');
 if(!Array.isArray(answer.gateResults) ||
    !unique(answer.gateResults.map(x=>x.gate)) ||
    answer.gateResults.length!==mandatory.length ||
    !mandatory.every(g=>answer.gateResults.some(x=>x.gate===g)))
   errors.push('GATE_SET_DRIFT');
 const evidence=Array.isArray(scenario.evidence)?scenario.evidence:[];
 const byId=new Map(evidence.filter(x=>text(x?.id)).map(x=>[x.id,x]));
 if(byId.size!==evidence.length)errors.push('CASE_EVIDENCE_DUPLICATE');
 const results=Array.isArray(answer.gateResults)?answer.gateResults:[];
 for(const gate of results){
   if(!ALLOWED.has(gate.status))errors.push('INVALID_GATE_STATE');
   if(!text(gate.finding)||gate.finding.length<42)
     errors.push('UNACTIONABLE_GATE_FINDING');
   if(!Array.isArray(gate.evidenceIds)||!unique(gate.evidenceIds)||
      !gate.evidenceIds.length)errors.push('NO_GATE_EVIDENCE');
   for(const id of gate.evidenceIds??[]){
     const src=byId.get(id);
     if(!src || src.gate!==gate.gate)
       errors.push('UNSUPPORTED_EVIDENCE_CITATION');
     else if(gate.status==='PASS' && src.revision!==scenario.candidate)
       errors.push('STALE_PASS_CLAIM');
   }
 }
 if(!text(answer.analysis)||answer.analysis.length<80 ||
    !Array.isArray(answer.nextActions) || answer.nextActions.length<1 ||
    answer.nextActions.length>4 ||
    !answer.nextActions.every(x=>text(x)&&x.length>=45))
    errors.push('NO_ACTIONABLE_REVIEW');
 // This is a *planned acceptance oracle*, not a model-generated result or
 // independent human certification. It is authored separately from answers.
 if(!isObject(scenario.oracle)||!DECISIONS.has(scenario.oracle.decision))
    errors.push('INVALID_ORACLE');
 else{
   if(answer.decision!==scenario.oracle.decision)errors.push('ORACLE_DECISION_MISMATCH');
   if(answer.policyStatus!==scenario.oracle.policy)errors.push('ORACLE_POLICY_MISMATCH');
   const expected=Array.isArray(scenario.oracle.gates)?scenario.oracle.gates:[];
   for(const [name,status] of expected){
     if(!results.some(x=>x.gate===name&&x.status===status))
       errors.push('ORACLE_GATE_MISMATCH');
   }
   if(expected.length!==results.length)errors.push('ORACLE_GATE_SET_MISMATCH');
 }
 const anyBlocked=results.some(x=>x.status==='BLOCKED');
 const anyUnknown=results.some(x=>x.status==='NOT_ESTABLISHED');
 const noPolicy=policy?.status!=='OWNER_ACCEPTED_IN_SYNTHETIC_CASE';
 const expectedDecision=anyBlocked?'HOLD':
    noPolicy||mandatory.length===0||anyUnknown?'EVIDENCE_INCOMPLETE':'READY_FOR_OWNER_DECISION';
 if(answer.decision!==expectedDecision)errors.push('DECISION_INVARIANT');
 if(Array.isArray(scenario.syntheticPrivateSpans)){
   const full=JSON.stringify(answer);
   if(scenario.syntheticPrivateSpans.some(secret=>
     typeof secret==='string'&&secret.length>0&&full.includes(secret)))
     errors.push('SYNTHETIC_SECRET_LEAK');
 }
 if(answer.decision==='READY_FOR_OWNER_DECISION'&&
    !answer.analysis.includes('not')&&!answer.analysis.includes('NOT'))
    errors.push('READINESS_OVERCLAIM');
 return fail(...errors);
}

/** Multiple case answers and per-case flags, preserving every attempted answer. */
export function scoreTrial(corpus,review){
 const errors=[];
 if(!isObject(corpus)||!isObject(review)||
    corpus.schema!==CASE_SCHEMA||review.schema!==ANSWER_SCHEMA||
    corpus.sourceSha256!==SOURCE_SHA||review.sourceSha256!==SOURCE_SHA ||
    corpus.sourceMethod!=='release-readiness-review' ||
    review.sourceMethod!=='release-readiness-review' ||
    review.reviewerIndependent!==false ||
    review.modelApiCalls!==0||review.hostExecutions!==0 ||
    review.evidenceClass!=='DIRECT_ASSISTANT_APPLIED_ORIGINAL_SOURCE_NOT_BLIND_NOT_HOST_VALIDATED')
   errors.push('REPORT_BOUNDARY');
 if(!Array.isArray(corpus.cases)||!Array.isArray(review.answers))
   return {schema:REPORT_SCHEMA,passed:0,failed:1,errors:['CORPUS_OR_ANSWERS_INVALID'],productionEligible:false,hostValidated:false};
 const cases=corpus.cases,answers=review.answers;
 if(!unique(cases.map(x=>x.id))||!unique(answers.map(x=>x.id))||
    cases.length!==answers.length||cases.length!==12)
   errors.push('CASE_COUNT_OR_ID_DRIFT');
 const byCase=new Map(cases.map(x=>[x.id,x]));
 const individual=answers.map(a=>{
   const c=byCase.get(a.id);
   return {id:a.id,issues:c?inspectAnswer(c,a):['UNKNOWN_CASE']};
 });
 if(cases.some(c=>!answers.some(x=>x.id===c.id)))errors.push('MISSING_CASE');
 const passed=individual.filter(x=>x.issues.length===0).length;
 return {
  schema:REPORT_SCHEMA,sourceSha256:SOURCE_SHA,
  evidenceClass:'NONINDEPENDENT_ASSISTANT_EMULATION_WITH_SYNTHETIC_RELEASE_INPUTS',
  actualConsumingHostExecutions:0,modelApiCalls:0,
  reviewerIndependent:false,producedSkillPublished:false,
  productionEligible:false,hostValidated:false,
  total:cases.length,passed,failed:individual.length-passed+errors.length,
  errors,individual,
  decisionDistribution:Object.fromEntries([...DECISIONS].map(x=>
   [x,answers.filter(a=>a.decision===x).length])),
 };
}

async function main(){
 const corpus=JSON.parse(await readFile(new URL('../tests/fixtures/release-readiness-v1-evaluation-12.json',import.meta.url),'utf8'));
 const review=JSON.parse(await readFile(new URL('../docs/evidence/release-readiness-v1-direct-review-12.json',import.meta.url),'utf8'));
 const score=scoreTrial(corpus,review);
 process.stdout.write(JSON.stringify(score,null,2)+'\n');
 if(score.failed>0||score.errors.length)process.exitCode=1;
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 main().catch(e=>{console.error(e);process.exitCode=1;});
