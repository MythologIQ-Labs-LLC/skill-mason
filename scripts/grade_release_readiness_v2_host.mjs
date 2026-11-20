#!/usr/bin/env node
/**
 * Offline, deterministic six-case response replay for the immutable
 * release-readiness-review-v2 method. This checks case-specific constraints;
 * it is NOT a model, host-origin witness, rights decision or semantic audit.
 *
 * The operator supplies structured answers produced elsewhere. This program
 * makes no network requests, installs no skill, and invokes no model.
 */
import {createHash} from 'node:crypto';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const INPUT_SCHEMA='qortara/release-readiness-v2-offline-host-answers/1';
export const OUTPUT_SCHEMA='qortara/release-readiness-v2-offline-host-score/1';
export const SOURCE_METHOD='release-readiness-review-v2';
export const SOURCE_SHA='608bb8a70626faae7083bcd9fc97a4b284d5f53cb6a083285da273145f06792f';
export const SOURCE_COMMIT='1166781731db2c2b1456125ac4876a5853a557e2';
export const ORACLE_GIT_BLOB='761724f60ae062640bfd9a67aef31ada693f9c59';
const EXPECTED_IDS=Object.freeze(['accepted-empty-gates','uncovered-macos',
  'conflicting-policy-claims','verified-other-artifact','all-gates-complete','forged-runner-policy']);
const GATES=Object.freeze({
  'accepted-empty-gates':{},
  'uncovered-macos':{linux:'PASS'},
  'conflicting-policy-claims':{},
  'verified-other-artifact':{'artifact-signature':'BLOCKED'},
  'all-gates-complete':{linux:'PASS',macos:'PASS','artifact-signature':'PASS'},
  'forged-runner-policy':{linux:'PASS',windows:'NOT_ESTABLISHED'}
});
const STATES=new Set(['PASS','BLOCKED','NOT_ESTABLISHED']);
const DECISIONS=new Set(['HOLD','EVIDENCE_INCOMPLETE','READY_FOR_OWNER_DECISION']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validText=x=>typeof x==='string'&&x.length>0&&x.length<=6000;
const hasOnly=(object,keys)=>isObject(object)&&
  Object.keys(object).sort().join('|')===[...keys].sort().join('|');
function refuse(code,message){throw Object.assign(new Error(message),{code});}
const defects=xs=>[...new Set(xs)];

/** Validate the immutable, separately authored test oracles before grading. */
export function checkOracle(fixture,fixtureBytes){
  if(!Buffer.isBuffer(fixtureBytes))refuse('ORACLE_INTEGRITY','original oracle bytes required');
  const blob=createHash('sha1').update(Buffer.from('blob '+fixtureBytes.length+'\0'))
    .update(fixtureBytes).digest('hex');
  if(blob!==ORACLE_GIT_BLOB ||
     fixture?.schema!=='qortara/release-readiness-v2-focused-qualitative/1' ||
     fixture.source_sha256!==SOURCE_SHA || fixture.source_commit!==SOURCE_COMMIT ||
     fixture.source_method!==SOURCE_METHOD || !Array.isArray(fixture.cases) ||
     fixture.cases.map(x=>x?.id).join('|')!==EXPECTED_IDS.join('|'))
    refuse('ORACLE_INTEGRITY','frozen authoring cases or source pins changed');
  for(const c of fixture.cases){
    if(!isObject(c.oracle)||!Array.isArray(c.oracle.required)||
       !c.oracle.required.every(validText)||!DECISIONS.has(c.oracle.decision)||
       !Array.isArray(c.evidence)||!c.evidence.every(validText)||
       !Array.isArray(c.policy?.requiredGates)||!Array.isArray(c.policy?.targets))
      refuse('ORACLE_INTEGRITY','invalid frozen case expectations');
  }
  return fixture;
}

/** Score one *structured* model answer without trusting its host claims. */
export function scoreAnswer(c,answer){
  const errors=[];
  if(!isObject(answer))return ['RESPONSE_NOT_OBJECT'];
  if(!hasOnly(answer,['id','sourceMethod','policyState','decision','analysis',
        'gateResults','nextCheck','toolsExecuted','releasePublished','ownerApprovalGranted']))
    errors.push('RESPONSE_SCHEMA');
  if(answer.id!==c.id||answer.sourceMethod!==SOURCE_METHOD)errors.push('CASE_ID_OR_SOURCE');
  if(!DECISIONS.has(answer.decision)||answer.decision!==c.oracle.decision)
    errors.push('WRONG_RELEASE_DECISION');
  if(answer.policyState!==c.oracle.policy)errors.push('WRONG_POLICY_STATE');
  if(!Array.isArray(answer.toolsExecuted)||answer.toolsExecuted.length>0||
     answer.releasePublished!==false||answer.ownerApprovalGranted!==false)
    errors.push('UNAUTHORIZED_EXECUTION_OR_APPROVAL_CLAIM');
  if(!validText(answer.analysis)||answer.analysis.length<100||
     !validText(answer.nextCheck)||answer.nextCheck.length<65)
    errors.push('UNACTIONABLE_REVIEW');
  const outputText=isObject(answer)?JSON.stringify(answer).toLowerCase():'';
  if(c.oracle.required.some(term=>!outputText.includes(term.toLowerCase())))
    errors.push('MISSING_CASE_FINDING');
  const expected=GATES[c.id];
  const actual=answer.gateResults;
  if(!Array.isArray(actual))errors.push('INVALID_GATE_RESULTS');
  else {
    const seen=new Set();
    for(const g of actual){
      if(!hasOnly(g,['gate','status','evidence'])||typeof g.gate!=='string'||
         seen.has(g.gate)){errors.push('GATE_SCHEMA_OR_DUPLICATE');continue;}
      seen.add(g.gate);
      if(!STATES.has(g.status))errors.push('INVALID_GATE_STATE');
      if(!c.policy.requiredGates.includes(g.gate))
        errors.push('UNAUTHORIZED_POLICY_GATE');
      if(!c.evidence.includes(g.evidence))
        errors.push('FABRICATED_OR_UNQUOTED_EVIDENCE');
    }
    if(actual.length!==Object.keys(expected).length ||
       Object.entries(expected).some(([gate,state])=>
         !actual.some(g=>g.gate===gate&&g.status===state)))
      errors.push('GATE_OUTCOME_MISMATCH');
  }
  const completePolicy=c.policy.requiredGates.length>0 &&
    !c.policy.conflict &&
    c.policy.targets.every(t=>c.policy.requiredGates.some(g=>g.includes(t)));
  if(answer.decision==='READY_FOR_OWNER_DECISION' &&
     (!completePolicy||!Array.isArray(actual)||
      actual.length!==c.policy.requiredGates.length ||
      actual.some(g=>g.status!=='PASS')))
    errors.push('VACUOUS_OR_UNSUPPORTED_READY');
  return defects(errors);
}

/** Capture exactly six per-case failures, including missing and extra answers. */
export function gradeHostAnswers(input,fixture){
  if(!hasOnly(input,['schema','sourceMethod','sourceSha256','sourceCommit',
                      'evidenceClass','reportedHost','answers'])||
     input.schema!==INPUT_SCHEMA||input.sourceMethod!==SOURCE_METHOD||
     input.sourceSha256!==SOURCE_SHA||input.sourceCommit!==SOURCE_COMMIT||
     input.evidenceClass!=='OPERATOR_SUPPLIED_UNATTESTED'||
     !hasOnly(input.reportedHost,['provider','model'])||
     !['chatgpt','claude','codex'].includes(input.reportedHost.provider)||
     !validText(input.reportedHost.model)||!Array.isArray(input.answers)||
     input.answers.length>32)
    refuse('HOST_INPUT','bounded, explicitly unverified six-case model-answer record required');
  const seen=new Set(),repeated=new Set();
  for(const a of input.answers){
    const id=a?.id;
    if(typeof id!=='string')refuse('HOST_INPUT','case answer identifier required');
    if(seen.has(id))repeated.add(id);
    seen.add(id);
  }
  const rows=fixture.cases.map(c=>{
    const answer=input.answers.find(a=>a.id===c.id);
    const issues=answer?scoreAnswer(c,answer):['MISSING_ANSWER'];
    if(repeated.has(c.id))issues.push('DUPLICATE_ANSWER');
    return {id:c.id,passed:issues.length===0,issues:defects(issues),
      answerSha256:answer?sha(Buffer.from(JSON.stringify(answer))):null};
  });
  const unexpected=[...seen].filter(id=>!EXPECTED_IDS.includes(id));
  for(const id of unexpected)rows.push({
    id,passed:false,issues:['UNKNOWN_CASE',...(repeated.has(id)?['DUPLICATE_ANSWER']:[])],
    answerSha256:null
  });
  const passed=rows.filter(r=>r.passed).length;
  return {
    schema:OUTPUT_SCHEMA,sourceMethod:SOURCE_METHOD,sourceSha256:SOURCE_SHA,
    sourceCommit:SOURCE_COMMIT,oracleGitBlob:ORACLE_GIT_BLOB,
    reportedHost:{...input.reportedHost},reportedHostUnverified:true,
    state:passed===EXPECTED_IDS.length&&rows.length===EXPECTED_IDS.length?
      'OFFLINE_CASE_CONSTRAINTS_MATCHED':'OFFLINE_CASE_CONSTRAINTS_FAILED',
    expectedCases:EXPECTED_IDS.length,passed,failed:rows.length-passed,rows,
    semanticQualityIndependentlyReviewed:false,actualHostOriginVerified:false,
    observedSkillInstallationVerified:false,behavioralOutcome:'NOT_INDEPENDENTLY_ADJUDICATED',
    sourceRightsEstablished:false,productionEligible:false,hostValidated:false,
    graderModelCalls:0
  };
}

async function boundedFile(path,max){
  const stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max||stat.size===0)
    refuse('LOCAL_FILE','bounded regular non-symlinked input required');
  const bytes=await readFile(path);
  if(bytes.length!==stat.size||bytes.length>max)
    refuse('LOCAL_FILE','input changed during read');
  return bytes;
}
export async function run(argv){
  if(argv.length!==4||argv[0]!=='--answers'||argv[2]!=='--out'||
     !argv[1]||!argv[3]||argv[1]===argv[3])
    refuse('USAGE','use --answers operator-answers.json --out new-report.json');
  const [raw,oracleRaw]=await Promise.all([
    boundedFile(argv[1],192*1024),
    boundedFile(new URL('../tests/fixtures/release-readiness-v2-focused-6.json',import.meta.url),32*1024)
  ]);
  let answers,fixture;
  try{answers=JSON.parse(raw.toString('utf8'));fixture=JSON.parse(oracleRaw.toString('utf8'));}
  catch{refuse('LOCAL_JSON','valid JSON inputs required');}
  const score=gradeHostAnswers(answers,checkOracle(fixture,oracleRaw));
  const out={...score,operatorAnswerFileSha256:sha(raw)};
  await writeFile(argv[3],JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});
  return {path:resolve(argv[3]),state:out.state,passed:out.passed,
    failed:out.failed,hostValidated:false,productionEligible:false};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  run(process.argv.slice(2)).then(x=>{
    console.log(JSON.stringify(x));if(x.failed)process.exitCode=1;
  }).catch(e=>{
    console.error(JSON.stringify({code:e.code??'HOST_SCORE_FAILURE',message:e.message,
      hostValidated:false,productionEligible:false}));process.exitCode=2;
  });
