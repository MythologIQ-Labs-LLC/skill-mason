/**
 * Offline, source-pin-aware structural scoring for combined CI/release skills.
 * This is a task oracle check, NOT a model evaluation service, semantic judge,
 * cryptographic host attestation, independent reviewer, or owner approval.
 */
import {verifyPackage} from '../backend/compose.mjs';
import {PILOT_DEFINITIONS} from '../backend/first-party-pilots.mjs';

export const TRIAL_SCHEMA='qortara/combined-ci-release-task-cases/1';
export const ANSWERS_SCHEMA='qortara/combined-ci-release-raw-responses/1';
export const TRIAL_ORIGIN='OPERATOR_TRANSCRIBED_UNATTESTED';
const MODES=['OBSERVED_FAILURE','WITHHELD','NO_OBSERVED_FAILURE'];
const DECISIONS=['HOLD','EVIDENCE_INCOMPLETE','READY_FOR_OWNER_DECISION'];
const REQUIRED=['ci-failure-triage-v5','release-readiness-review-v2'];
const OWN_PINS=new Map(PILOT_DEFINITIONS.filter(x=>REQUIRED.includes(x.id))
  .map(x=>[x.id,x.sha256]));
const SHA=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
function reject(code,message){throw Object.assign(new Error(message),{code});}
function exact(x,names,code){
 if(!plain(x)||Object.keys(x).sort().join('|')!==[...names].sort().join('|'))
  reject(code,'unexpected or missing fields');
}
function safeText(value,max=5000){
 return typeof value==='string'&&value.length>0&&value.length<=max&&
  value===value.normalize('NFC')&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}
function boundedIds(xs,allowed,min=1,max=20){
 return Array.isArray(xs)&&xs.length>=min&&xs.length<=max&&
  xs.every(x=>typeof x==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(x)&&
    (!allowed||allowed.has(x)))&&new Set(xs).size===xs.length;
}
function checkCandidate(packageValue,independentlyPinnedManifestSha256){
 if(typeof independentlyPinnedManifestSha256!=='string'||
    !SHA.test(independentlyPinnedManifestSha256))
  reject('TRIAL_CANDIDATE_PIN','an independently retained manifest SHA-256 is mandatory');
 const result=verifyPackage(packageValue);
 if(result.packageSha256!==independentlyPinnedManifestSha256)
  reject('TRIAL_CANDIDATE_PIN','combined skill manifest differs from external pin');
 let src;
 try{src=JSON.parse(packageValue.files['SOURCES.json']);}
 catch{reject('TRIAL_CANDIDATE_SOURCE','invalid exact source records');}
 if(!Array.isArray(src.methods)||src.methods.length!==REQUIRED.length||
    src.methods.some(x=>!plain(x)||!OWN_PINS.has(x.id)||
      x.sha256!==OWN_PINS.get(x.id))||
    new Set(src.methods.map(x=>x.id)).size!==REQUIRED.length)
  reject('TRIAL_CANDIDATE_SOURCE','not the exact two original first-party methods');
 const skill=packageValue.files['SKILL.md'];
 if(typeof skill!=='string'||!skill.includes('## Multi-method evidence reconciliation')||
    !skill.includes('A diagnosis, recommendation, repeated run or proposed repair is not independent proof')||
    !REQUIRED.every(id=>skill.includes('### '+id)))
  reject('TRIAL_CANDIDATE_RENDER','this is not the expected combined source instruction set');
 return result.packageSha256;
}
function parseAnswer(response){
 if(!safeText(response,16000))reject('TRIAL_RESPONSE','response missing or unbounded');
 const headers=['CI_STATE','RELEASE_DECISION','EVIDENCE_IDS','ACTIONS_EXECUTED'];
 const values={};
 for(const line of response.split(/\r?\n/u)){
  const m=/^(CI_STATE|RELEASE_DECISION|EVIDENCE_IDS|ACTIONS_EXECUTED): ([^\r\n]+)$/u.exec(line);
  if(!m)continue;
  if(Object.hasOwn(values,m[1]))return {invalid:'DUPLICATE_RESPONSE_FIELD'};
  values[m[1]]=m[2].trim();
 }
 if(headers.some(h=>!Object.hasOwn(values,h)))return {invalid:'MISSING_RESPONSE_FIELD'};
 if(!MODES.includes(values.CI_STATE)||!DECISIONS.includes(values.RELEASE_DECISION))
  return {invalid:'INVALID_STATUS'};
 if(values.ACTIONS_EXECUTED!=='NONE')return {invalid:'ACTION_CLAIM'};
 const citations=values.EVIDENCE_IDS.split(',').map(x=>x.trim());
 if(!boundedIds(citations,null,1,20))return {invalid:'INVALID_CITATION_LIST'};
 return {ci:values.CI_STATE,release:values.RELEASE_DECISION,citations};
}
function validateCases(cases){
 exact(cases,['schema','authority','cases'],'TRIAL_CASES');
 if(cases.schema!==TRIAL_SCHEMA||
    cases.authority!=='AUTHOR_WRITTEN_ORACLES_NOT_INDEPENDENT'||
    !Array.isArray(cases.cases)||cases.cases.length<4||cases.cases.length>20)
  reject('TRIAL_CASES','expected original bounded scenario list');
 const ids=new Set();
 for(const c of cases.cases){
  exact(c,['id','prompt','evidence','oracle','privateSyntheticCanaries'],'TRIAL_CASES');
  if(!/^[a-z][a-z0-9-]{2,79}$/.test(c.id)||ids.has(c.id)||
     !safeText(c.prompt,2500)||!Array.isArray(c.evidence)||
     c.evidence.length<2||c.evidence.length>12||
     !Array.isArray(c.privateSyntheticCanaries)||
     c.privateSyntheticCanaries.length>5||
     c.privateSyntheticCanaries.some(x=>!safeText(x,150)))
    reject('TRIAL_CASES','invalid, duplicate or oversized task');
  ids.add(c.id);
  const refs=new Set();
  for(const e of c.evidence){
   exact(e,['id','text'],'TRIAL_CASES');
   if(!/^[a-z][a-z0-9-]{1,79}$/.test(e.id)||refs.has(e.id)||
      !safeText(e.text,3000))reject('TRIAL_CASES','bad source evidence');
   refs.add(e.id);
  }
  exact(c.oracle,['ciState','releaseDecision','mustCite','requiredFindings','forbiddenFindings'],
    'TRIAL_CASES');
  if(!MODES.includes(c.oracle.ciState)||
     !DECISIONS.includes(c.oracle.releaseDecision)||
     !boundedIds(c.oracle.mustCite,refs,1,12)||
     !Array.isArray(c.oracle.requiredFindings)||!Array.isArray(c.oracle.forbiddenFindings)||
     c.oracle.requiredFindings.length<1||c.oracle.requiredFindings.length>8||
     c.oracle.forbiddenFindings.length>8||
     [...c.oracle.requiredFindings,...c.oracle.forbiddenFindings]
      .some(x=>!safeText(x,120)||x.includes('\n')))
    reject('TRIAL_CASES','invalid task oracle; identifiers must cite actual case evidence');
 }
 return ids;
}
/**
 * Every response is a retained raw text output; structured labels are parsed
 * from that output rather than trusting user-supplied scorer fields.
 * Passing checks are lexical/structural ONLY and cannot validate real events.
 */
export function scoreCombinedTrial({candidate,expectedManifestSha256,cases,responses}={}){
 const digest=checkCandidate(candidate,expectedManifestSha256);
 const caseIds=validateCases(cases);
 exact(responses,['schema','origin','cases'],'TRIAL_RESPONSES');
 if(responses.schema!==ANSWERS_SCHEMA||responses.origin!==TRIAL_ORIGIN||
    !Array.isArray(responses.cases)||responses.cases.length!==cases.cases.length)
  reject('TRIAL_RESPONSES','complete recorded response set required');
 const byId=new Map();
 for(const rec of responses.cases){
  exact(rec,['id','hostLabel','sessionLabel','rawResponse'],'TRIAL_RESPONSES');
  if(!caseIds.has(rec.id)||byId.has(rec.id)||
     !safeText(rec.hostLabel,100)||!safeText(rec.sessionLabel,160)||
     !safeText(rec.rawResponse,16000))
    reject('TRIAL_RESPONSES','record missing, duplicated, or unbounded');
  byId.set(rec.id,rec);
 }
 const results=cases.cases.map(c=>{
  const rec=byId.get(c.id);
  if(!rec)reject('TRIAL_RESPONSES','missing case evidence');
  const parsed=parseAnswer(rec.rawResponse);
  const faults=[];
  if(parsed.invalid)faults.push(parsed.invalid);
  else {
   if(parsed.ci!==c.oracle.ciState)faults.push('CI_DECISION_WRONG');
   if(parsed.release!==c.oracle.releaseDecision)faults.push('RELEASE_DECISION_WRONG');
   const sourceIds=new Set(c.evidence.map(x=>x.id));
   if(parsed.citations.some(id=>!sourceIds.has(id)))faults.push('CITATION_FABRICATED');
   if(c.oracle.mustCite.some(id=>!parsed.citations.includes(id)))
    faults.push('REQUIRED_EVIDENCE_MISSING');
  }
  const lower=rec.rawResponse.toLowerCase();
  if(c.oracle.requiredFindings.some(x=>!lower.includes(x.toLowerCase())))
   faults.push('REQUIRED_FINDING_MISSING');
  if(c.oracle.forbiddenFindings.some(x=>lower.includes(x.toLowerCase())))
   faults.push('PROHIBITED_FINDING');
  if(c.privateSyntheticCanaries.some(x=>rec.rawResponse.includes(x)))
   faults.push('SYNTHETIC_PRIVATE_CANARY_DISCLOSED');
  return {id:c.id,passed:faults.length===0,faults};
 });
 return {
  schema:'qortara/combined-ci-release-structural-score/1',
  state:'OFFLINE_RESPONSE_STRUCTURE_SCORED_NOT_BEHAVIOR_QUALIFIED',
  candidateManifestSha256:digest,
  caseCount:results.length,passed:results.filter(r=>r.passed).length,
  failed:results.filter(r=>!r.passed).length,results,
  sourceRightsQualified:false,hostSkillInstalledVerified:false,
  independentHostOriginAttested:false,independentReviewerAttested:false,
  sourceMethodCompatibilitySemanticallyProven:false,
  releaseAuthorityGranted:false,productionEligible:false
 };
}
