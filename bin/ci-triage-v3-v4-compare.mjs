#!/usr/bin/env node
/** Paired, source-pinned comparison of REAL P0-generated CI triage v3 and v4.
 * No inference unless explicitly invoked with an external owner API key.
 * A strict lexical judge is NOT independent qualitative review, rights or native host acceptance.
 */
import {createHash} from 'node:crypto';
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPackage,verifyPackage} from '../src/backend/compose.mjs';
import {scoreSpectrum,validateSpectrum} from './ci-triage-spectrum-trial.mjs';
import {openAiCompletion} from './ci-triage-live-host-test.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const SOURCE_SNAPSHOT='de2be11765ede34be59d9a64c2a1b434b0ca4bcc';
export const PAIR_PINS=Object.freeze({
  v3:Object.freeze({
    id:'ci-failure-triage-v3',
    manifestSha256:'ef2dcaa94b223b79fc261d3c0609905da3fdc982a5cfa79ff44cc44fc8ea0f6b',
    skillSha256:'2ded798ba865468ae2f0a8a649c1f2172c89a810e73e27cbef7e7e458f69274e',
    sourceSha256:'fcc156c7ac3c369716ab0fa957159996ae25d193b22c7805790fb100ee5669d5',
    originalCommit:'31e2c4b2c74632fea690a02910c69f06087ffc13'
  }),
  v4:Object.freeze({
    id:'ci-failure-triage-v4',
    manifestSha256:'c24420fccb0b1be0fc269e6575ed187ca0b0ea6ee0b91cfd515c097eafd9de89',
    skillSha256:'51908ef10d7fb461563752c63225fdf14e01c18bfd27e44257ed04e6b8e5b83a',
    sourceSha256:'2aae2a88a499cf7d65f70d03e619f25ca8e790f07481c3b2eb05ed563faaf761',
    originalCommit:'de2be11765ede34be59d9a64c2a1b434b0ca4bcc'
  })
});
const FIELDS=['observed_failure','evidence','cause_hypothesis_and_uncertainty',
  'next_verification','completion_criteria','abstains','actions_executed','verification_executed'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function refuse(code,message){throw Object.assign(new Error(message),{code});}

export async function openPinnedSkill(dir,arm){
  const pin=PAIR_PINS[arm];
  if(!pin)refuse('PAIR_ARM','only two original P0-generated packages permitted');
  const pkg=await readPackage(dir);
  const check=verifyPackage(pkg);
  const skill=pkg.files['SKILL.md'];
  if(check.packageSha256!==pin.manifestSha256||SHA(Buffer.from(skill))!==pin.skillSha256)
    refuse('PAIR_PIN','original generated package or instructions changed');
  const sources=JSON.parse(pkg.files['SOURCES.json']);
  const receipt=JSON.parse(pkg.files['RECEIPT.json']);
  if(sources?.methods?.length!==1||sources.methods[0]?.id!==pin.id||
     sources.methods[0]?.sha256!==pin.sourceSha256||
     sources.methods[0]?.commit!==pin.originalCommit||
     sources.sourceSnapshot?.commit!==SOURCE_SNAPSHOT||
     receipt.claim!=='DEVELOPMENT_CANDIDATE'||
     receipt.productionEligible!==false||receipt.hostValidated!==false||
     receipt.modelCallsMeasured!==false)
    refuse('PAIR_PROVENANCE','source or P0 synthetic qualification state changed');
  return {skill,manifestSha256:check.packageSha256,sha256:pin.skillSha256,
    sourceSha256:pin.sourceSha256};
}

const OUTPUT_FORMAT='For evaluation, return ONLY a JSON object with exactly these fields: '+
 '{"observed_failure":"text","evidence":["verbatim lines from supplied log"],'+
 '"cause_hypothesis_and_uncertainty":"text","next_verification":"text",'+
 '"completion_criteria":"text","abstains":false,"actions_executed":[],'+
 '"verification_executed":"NOT_RUN"}. No Markdown wrapper.';
// This contract is intentionally FORMAT-ONLY. It does not add the v4 trust
// or diagnostic rules to either arm, unlike the older four-case harness.
export function messagesForSkill(skill,item){
  return [
    {role:'system',content:skill+'\n\n'+OUTPUT_FORMAT},
    {role:'user',content:item.request+'\n\n<supplied_ci_log>\n'+item.log+'\n</supplied_ci_log>'}
  ];
}
function summarize(rows,arm){
  const groups=Object.fromEntries([...new Set(rows.map(r=>r.group))].map(group=>{
    const records=rows.filter(r=>r.group===group);
    return [group,{
      passed:records.filter(r=>r.arms[arm]?.score?.pass===true).length,
      total:records.length,
      failureReasons:Object.entries(records.flatMap(r=>
        r.arms[arm]?.score?.flags??[]).reduce((a,k)=>(a[k]=(a[k]??0)+1,a),{}))
        .sort(([a],[b])=>a.localeCompare(b))
    }];
  }));
  return {
    passed:rows.filter(r=>r.arms[arm]?.score?.pass===true).length,
    total:rows.length,groups,
    observedTokenUsageCases:rows.filter(r=>Number.isInteger(r.arms[arm]?.usage?.prompt_tokens)&&
      Number.isInteger(r.arms[arm]?.usage?.completion_tokens)).length,
    promptTokens:rows.every(r=>Number.isInteger(r.arms[arm]?.usage?.prompt_tokens))
      ?rows.reduce((n,r)=>n+r.arms[arm].usage.prompt_tokens,0):null,
    completionTokens:rows.every(r=>Number.isInteger(r.arms[arm]?.usage?.completion_tokens))
      ?rows.reduce((n,r)=>n+r.arms[arm].usage.completion_tokens,0):null,
    totalObservedLatencyMs:rows.reduce((n,r)=>n+(r.arms[arm]?.latencyMs??0),0)
  };
}

export async function compareSealedSkills({
  v3Dir,v4Dir,cases,model,token,completion=openAiCompletion,live=false,onResult
}={}){
  const c=validateSpectrum(cases);
  const sealed={v3:await openPinnedSkill(v3Dir,'v3'),v4:await openPinnedSkill(v4Dir,'v4')};
  if(sealed.v3.skill===sealed.v4.skill)refuse('PAIR_SAME','v3 and v4 source instructions must differ');
  const actualProvider=live===true&&completion===openAiCompletion;
  const rows=[];
  for(let index=0;index<c.length;index++){
    const item=c[index];
    const arms={};
    // Alternate order to avoid systematic first-arm effects.
    for(const arm of index%2===0?['v3','v4']:['v4','v3']){
      const started=process.hrtime.bigint();
      const result=await completion({model,token,messages:messagesForSkill(sealed[arm].skill,item)});
      const latencyMs=Math.round(Number(process.hrtime.bigint()-started)/1e6);
      if(!obj(result)||typeof result.output!=='string'||result.output.length>25000)
        refuse('PAIR_HOST','invalid bounded host answer');
      const entry={
        score:scoreSpectrum(result.output,item),output:result.output,
        model:result.model??model,requestId:result.id??null,usage:result.usage??null,
        latencyMs
      };
      arms[arm]=entry;
      if(onResult)await onResult({caseId:item.id,group:item.group,arm,...entry});
    }
    rows.push({id:item.id,group:item.group,mode:item.oracle.mode,arms});
  }
  const results={v3:summarize(rows,'v3'),v4:summarize(rows,'v4')};
  const wins={
    v3:rows.filter(r=>r.arms.v3.score.pass&&!r.arms.v4.score.pass).length,
    v4:rows.filter(r=>r.arms.v4.score.pass&&!r.arms.v3.score.pass).length,
    bothPass:rows.filter(r=>r.arms.v3.score.pass&&r.arms.v4.score.pass).length,
    neitherPass:rows.filter(r=>!r.arms.v3.score.pass&&!r.arms.v4.score.pass).length
  };
  return {
    schema:'qortara/ci-triage-v3-v4-host-compare/1',
    state:actualProvider?'LIVE_TEXT_MODEL_OUTPUTS_RECORDED':'TEST_DOUBLE_NOT_HOST_EVIDENCE',
    providerModel:model,source:'EXACT_V3_V4_SEALED_REAL_P0_GENERATED_SKILLS',
    packageHashes:{v3:sealed.v3.manifestSha256,v4:sealed.v4.manifestSha256},
    instructionHashes:{v3:sealed.v3.sha256,v4:sealed.v4.sha256},
    caseCount:c.length,modelCalls:c.length*2,
    testOraclesIndependentlyAdjudicated:false,
    modelHostOriginIndependentlyAttested:false,
    automatedRubric:'STRICT_LEXICAL_EXPERIMENTAL_NOT_SEMANTIC_OR_INDEPENDENT',
    hostSkillsNativelyInstalled:false,
    hostBehaviorObserved:actualProvider,
    modelInferenceDuringBuild:'NOT_INSTRUMENTED_HERE',
    sourceRightsQualified:false,prismTrustApproved:false,productionEligible:false,
    scores:results,pairedOutcomes:wins,rows
  };
}
export async function loadComparisonCases(){
  const raw=await readFile(new URL('../tests/fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url));
  const cases=JSON.parse(raw.toString('utf8'));
  validateSpectrum(cases);
  return {cases,raw};
}
export async function main(args=process.argv.slice(2)){
  const values={};
  for(let i=0;i<args.length;i+=2){
    if(!['--v3-dir','--v4-dir','--model','--report'].includes(args[i])||
      !args[i+1]||Object.hasOwn(values,args[i]))
      refuse('PAIR_USAGE','required --v3-dir DIR --v4-dir DIR --model ID --report NEW.json');
    values[args[i]]=args[i+1];
  }
  if(Object.keys(values).length!==4)refuse('PAIR_USAGE','four explicit parameters required');
  const token=process.env.OPENAI_API_KEY;
  if(typeof token!=='string'||token.length<10)
    refuse('PAIR_AUTH','owner-approved provider key required');
  const {cases,raw}=await loadComparisonCases();
  const report=resolve(values['--report']);
  const partial=report+'.partial.jsonl';
  await writeFile(partial,'',{flag:'wx',mode:0o600});
  const result=await compareSealedSkills({
    v3Dir:resolve(values['--v3-dir']),v4Dir:resolve(values['--v4-dir']),
    model:values['--model'],token,cases,live:true,
    onResult:async observation=>appendFile(partial,JSON.stringify(observation)+'\n')
  });
  result.casesSha256=SHA(raw);
  await writeFile(report,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    state:result.state,caseCount:result.caseCount,pairedOutcomes:result.pairedOutcomes,
    scores:Object.fromEntries(Object.entries(result.scores).map(([k,v])=>[k,v.passed])),
    sourceRightsQualified:false,productionEligible:false
  }));
  return 0; // A negative quality finding is evidence, not a CI-integrity failure.
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  main().then(n=>{process.exitCode=n;}).catch(e=>{
    console.error(JSON.stringify({code:e?.code??'PAIR_ERROR',message:String(e.message??e),
      liveHostQualified:false,productionEligible:false}));
    process.exitCode=2;
  });
}
