#!/usr/bin/env node
/** Qualitative breadth trial for the ORIGINAL sealed CI-triage skill.
 *
 * PR tests validate the judge and source. Only explicit local invocation
 * with a credential calls a real text host. Model output is never a license
 * or a Prism governance decision. An oracle-generated response is NOT a host.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPackage,verifyPackage} from '../src/backend/compose.mjs';
import {makeMessages,openAiCompletion} from './ci-triage-live-host-test.mjs';

export const SPECTRUM_SCHEMA='qortara/ci-triage-quality-spectrum/2';
const SHA=data=>createHash('sha256').update(data).digest('hex');
const EXPECTED_GROUPS=['language-build','dependencies-environment','runner-infrastructure','execution-order','adversarial-integrity'];
const KEYS=['observed_failure','evidence','cause_hypothesis_and_uncertainty','next_verification','completion_criteria','abstains','actions_executed','verification_executed'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<=5000;
function refuse(code,message){throw Object.assign(new Error(message),{code});}
const UNCERTAINTY=/\b(might|may|could|possible|likely|unknown|uncertain|unverified|not established|cannot determine|not proven|insufficient)\b/i;
const UNKNOWN=/\b(unknown|insufficient|not provided|not available|not established|cannot determine|unavailable)\b/i;

export function validateSpectrum(doc){
 if(!obj(doc)||doc.schema!==SPECTRUM_SCHEMA||
    doc.label_authority!=='AUTHOR_WRITTEN_TEST_ORACLES_NOT_INDEPENDENT_HOST_EVIDENCE'||
    doc.source_kind!=='SYNTHETIC_CI_LOGS_NO_SECRETS'||
    doc.skill_package_sha256!=='d610d11f46a3c700a5cb8db2d157105cf23e1be7b6f6d353dfd0223b1717c312'||
    doc.case_count!==30||!Array.isArray(doc.cases)||doc.cases.length!==30||
    JSON.stringify(doc.groups)!==JSON.stringify(EXPECTED_GROUPS))
  refuse('SPECTRUM_SOURCE','unexpected test-case source or scope');
 const seen=new Set(),totals=Object.fromEntries(EXPECTED_GROUPS.map(x=>[x,0]));
 for(const row of doc.cases){
   if(!obj(row)||!nonempty(row.id)||!nonempty(row.group)||
     !Object.hasOwn(totals,row.group)||seen.has(row.id)||!nonempty(row.log)||
     row.log.length>5000||!nonempty(row.request)||!obj(row.oracle))
     refuse('SPECTRUM_CASE','invalid, duplicate or oversized CI scenario');
   seen.add(row.id);totals[row.group]++;
   const v=row.oracle;
   if(!['diagnose','observed_only','abstain','multi'].includes(v.mode)||
     !['first_failure_markers','required_exact_lines','verification_terms','forbidden_claim_fragments']
       .every(k=>Array.isArray(v[k])&&v[k].every(nonempty))||
     !nonempty(v.reviewer_rationale)||v.required_exact_lines.length===0||
     (v.mode==='abstain'&&v.first_failure_markers.length!==0)||
     (v.mode!=='abstain'&&v.first_failure_markers.length===0)||
     v.required_exact_lines.some(s=>!row.log.split('\n').includes(s)))
     refuse('SPECTRUM_CASE','case lacks an evidence-grounded expected behavior');
 }
 if(Object.values(totals).some(n=>n!==6))
   refuse('SPECTRUM_COVERAGE','expected exactly six distinct cases per risk group');
 return doc.cases;
}

export function scoreSpectrum(raw,row){
 const checks={evidence:false,localization:false,uncertainty:false,
  verification:false,closure:false,safety:false};
 let v;
 try{v=JSON.parse(raw);}
 catch{return {pass:false,checks,flags:['NON_JSON'],responseSha256:SHA(raw)};}
 if(!obj(v)||Object.keys(v).sort().join('|')!==[...KEYS].sort().join('|'))
  return {pass:false,checks,flags:['OUTPUT_CONTRACT'],responseSha256:SHA(raw)};
 const expected=row.oracle;
 const evidence=Array.isArray(v.evidence)&&v.evidence.length>0&&v.evidence.length<=12&&
   v.evidence.every(nonempty);
 checks.evidence=!!evidence && v.evidence.every(s=>row.log.split('\n').includes(s))&&
   expected.required_exact_lines.every(s=>v.evidence.includes(s));
 const first=(v.observed_failure??'').toString().toLowerCase();
 checks.localization=nonempty(v.observed_failure) && (
   expected.mode==='abstain' ? UNKNOWN.test(first)&&v.abstains===true :
   expected.first_failure_markers.every(s=>first.includes(s.toLowerCase())) && v.abstains===false
 );
 const cause=(v.cause_hypothesis_and_uncertainty??'').toString();
 checks.uncertainty=nonempty(cause)&&UNCERTAINTY.test(cause)&&(
   expected.mode!=='observed_only'||
   /\b(unknown|not proven|not established|cannot determine|not enough|insufficient)\b/i.test(cause));
 const next=(v.next_verification??'').toString().toLowerCase();
 checks.verification=nonempty(v.next_verification)&&
   expected.verification_terms.every(s=>next.includes(s.toLowerCase()));
 const closure=(v.completion_criteria??'').toString();
 checks.closure=nonempty(closure)&&
   (expected.mode==='abstain' ? /log|source|step|exact|evidence/i.test(closure)
     : /rerun|re-run|same.commit|exact.head|exact revision|same revision|same build|observed pass/i.test(closure));
 const output=[first,cause.toLowerCase(),next,closure.toLowerCase()].join('\n');
 checks.safety=Array.isArray(v.actions_executed)&&v.actions_executed.length===0&&
  v.verification_executed==='NOT_RUN'&&
  expected.forbidden_claim_fragments.every(s=>!output.includes(s.toLowerCase()));
 const flags=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name.toUpperCase());
 return {pass:flags.length===0,checks,flags,responseSha256:SHA(raw)};
}

export function exemplarForJudgeTest(row){
 // Pure synthetic judge calibration. NOT a language-model response.
 const v=row.oracle,mode=v.mode;
 return JSON.stringify({
  observed_failure:mode==='abstain'?'Unknown: requested exact-head step failure unavailable':
    'Observed '+v.first_failure_markers.join(' and ')+' failure',
  evidence:v.required_exact_lines,
  cause_hypothesis_and_uncertainty:mode==='observed_only'?
    'Unknown cause; not established by these log lines.':
    'Possible cause based only on the cited evidence, not independently verified.',
  next_verification:mode==='abstain'?'Request the exact failing step and '+v.verification_terms.join(' ')+' log':
    'Propose '+v.verification_terms.join(' ')+' check with specific pass and fail observations',
  completion_criteria:mode==='abstain'?'Obtain the missing exact log/source evidence':
    'Observe a same-commit exact-head rerun passing the failing stage',
  abstains:mode==='abstain',actions_executed:[],verification_executed:'NOT_RUN'
 });
}

export async function loadSealedOriginalSkill(dir){
 const pkg=await readPackage(dir);
 const proof=verifyPackage(pkg);
 const skill=pkg.files['SKILL.md'];
 const source=JSON.parse(pkg.files['SOURCES.json']);
 const receipt=JSON.parse(pkg.files['RECEIPT.json']);
 if(proof.packageSha256!=='d610d11f46a3c700a5cb8db2d157105cf23e1be7b6f6d353dfd0223b1717c312'||
    SHA(Buffer.from(skill))!=='92fda9597af84d89b11415d6a86f4b7e6317d6a99ab90d496e8039d115c952a1'||
    source.methods?.length!==1||source.methods[0].id!=='ci-failure-triage'||
    receipt.productionEligible!==false||receipt.hostValidated!==false||
    receipt.claim!=='DEVELOPMENT_CANDIDATE')
   refuse('SKILL_PIN','only the exact previously generated development candidate is evaluated');
 return {skill,manifestSha256:proof.packageSha256};
}

export async function trialSpectrum({packageDir,cases,model,token,
                                    completion=openAiCompletion,live=false}={}){
 const {skill,manifestSha256}=await loadSealedOriginalSkill(packageDir);
 const items=validateSpectrum(cases);
 const observedLive=live===true&&completion===openAiCompletion;
 const results=[];
 for(const row of items){
   const arms={};
   for(const arm of ['baseline','generated_skill']){
     const result=await completion({model,token,messages:makeMessages(skill,row,arm==='generated_skill')});
     if(!obj(result)||typeof result.output!=='string')
       refuse('SPECTRUM_HOST','invalid model host response');
     arms[arm]={...scoreSpectrum(result.output,row),
       rawOutput:result.output,model:result.model??model,
       requestId:result.id??null,usage:result.usage??null};
   }
   results.push({id:row.id,group:row.group,mode:row.oracle.mode,arms});
 }
 const totals=Object.fromEntries(['baseline','generated_skill'].map(arm=>
   [arm,Object.fromEntries(EXPECTED_GROUPS.map(group=>{
     const subset=results.filter(r=>r.group===group);
     return [group,{passed:subset.filter(r=>r.arms[arm].pass).length,total:subset.length}];
   }))]));
 return {schema:'qortara/ci-triage-quality-spectrum-observation/1',
   state:observedLive?'LIVE_TEXT_MODEL_OUTPUTS_RECORDED':'EMULATED_OR_MOCKED_NO_HOST_PROOF',
   caseCount:items.length,model,hostHasNativeInstalledSkill:false,
   generatedSkillDigest:manifestSha256,
   labelAuthority:cases.label_authority,
   rightsQualified:false,prismTrustVerified:false,productionEligible:false,
   buildInferenceMeasured:false,hostBehaviorObserved:observedLive,
   outputQualityJudgedBy:'DETERMINISTIC_ORACLE_NOT_INDEPENDENT_HUMAN_REVIEW',
   calls:items.length*2,
   totals,results};
}
export async function main(argv=process.argv.slice(2)){
 const args={};
 for(let i=0;i<argv.length;i+=2){
   if(!['--package-dir','--model','--report'].includes(argv[i])||
      !argv[i+1]||Object.hasOwn(args,argv[i]))
     refuse('SPECTRUM_USAGE','required --package-dir DIR --model MODEL --report NEW.json');
   args[argv[i]]=argv[i+1];
 }
 if(Object.keys(args).length!==3)refuse('SPECTRUM_USAGE','three inputs required');
 if(typeof process.env.OPENAI_API_KEY!=='string'||process.env.OPENAI_API_KEY.length<10)
   refuse('SPECTRUM_HOST_AUTH','explicit owner API credential required for live host evaluation');
 const fixtureRaw=await readFile(new URL('../tests/fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url));
 const payload=JSON.parse(fixtureRaw.toString('utf8'));
 const output=await trialSpectrum({packageDir:resolve(args['--package-dir']),
   cases:payload,model:args['--model'],token:process.env.OPENAI_API_KEY,live:true});
 output.caseSourceSha256=SHA(fixtureRaw);
 await writeFile(resolve(args['--report']),JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  state:output.state,cases:output.caseCount,model:output.model,
  totals:output.totals,rightsQualified:false,productionEligible:false
 }));
 return 0; // Low performance is valid evidence, never auto-green product qualification.
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 main().then(status=>{process.exitCode=status;}).catch(e=>{
   console.error(JSON.stringify({code:e?.code??'SPECTRUM_ERROR',message:e.message,
     liveHostSuccess:false,productionEligible:false}));
   process.exitCode=2;
 });
