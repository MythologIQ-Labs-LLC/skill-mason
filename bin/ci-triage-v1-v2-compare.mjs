#!/usr/bin/env node
/** Paired, source-pinned comparison of REAL P0-generated CI triage v1 and v2.
 * No inference unless explicitly invoked with an external owner API key.
 * Passing deterministic judge checks does NOT imply human approval or rights.
 */
import {createHash} from 'node:crypto';
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPackage,verifyPackage} from '../src/backend/compose.mjs';
import {scoreSpectrum,validateSpectrum} from './ci-triage-spectrum-trial.mjs';
import {openAiCompletion} from './ci-triage-live-host-test.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const SOURCE_SNAPSHOT='ef8bd8046df65ca2a7419a7191f8f2e959d53156';
export const PAIR_PINS=Object.freeze({
  v1:Object.freeze({
    id:'ci-failure-triage',
    manifestSha256:'877c30b5abcc65cc8b09c03c0ca677f9f4956e7c5885548e2b96962ac8cfc2fd',
    skillSha256:'92fda9597af84d89b11415d6a86f4b7e6317d6a99ab90d496e8039d115c952a1',
    sourceSha256:'9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47',
    originalCommit:'87a6a5965a25af95a50127f26ec5afb404e0f2b8'
  }),
  v2:Object.freeze({
    id:'ci-failure-triage-v2',
    manifestSha256:'a950f740323450ffff774d286435fe1ef7ad247dfbe24fab8ead88d2fe6a4c5d',
    skillSha256:'25b74b564861e72b3d2e63060177d39e35c995875c589976f2b1fa401b3ef714',
    sourceSha256:'0b3350725eee7c5ef8c6d7bff5db7538ba546a8597c35c601499c85434cbe2c1',
    originalCommit:SOURCE_SNAPSHOT
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
// This contract is intentionally FORMAT-ONLY. It does not add the v2 trust
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
    promptTokens:rows.reduce((n,r)=>n+(r.arms[arm]?.usage?.prompt_tokens??0),0),
    completionTokens:rows.reduce((n,r)=>n+(r.arms[arm]?.usage?.completion_tokens??0),0)
  };
}

export async function compareSealedSkills({
  v1Dir,v2Dir,cases,model,token,completion=openAiCompletion,live=false,onResult
}={}){
  const c=validateSpectrum(cases);
  const sealed={v1:await openPinnedSkill(v1Dir,'v1'),v2:await openPinnedSkill(v2Dir,'v2')};
  if(sealed.v1.skill===sealed.v2.skill)refuse('PAIR_SAME','v1 and v2 source instructions must differ');
  const actualProvider=live===true&&completion===openAiCompletion;
  const rows=[];
  for(let index=0;index<c.length;index++){
    const item=c[index];
    const arms={};
    // Alternate order to avoid systematic first-arm effects.
    for(const arm of index%2===0?['v1','v2']:['v2','v1']){
      const result=await completion({model,token,messages:messagesForSkill(sealed[arm].skill,item)});
      if(!obj(result)||typeof result.output!=='string'||result.output.length>25000)
        refuse('PAIR_HOST','invalid bounded host answer');
      const entry={
        score:scoreSpectrum(result.output,item),output:result.output,
        model:result.model??model,requestId:result.id??null,usage:result.usage??null
      };
      arms[arm]=entry;
      if(onResult)await onResult({caseId:item.id,group:item.group,arm,...entry});
    }
    rows.push({id:item.id,group:item.group,mode:item.oracle.mode,arms});
  }
  const results={v1:summarize(rows,'v1'),v2:summarize(rows,'v2')};
  const wins={
    v1:rows.filter(r=>r.arms.v1.score.pass&&!r.arms.v2.score.pass).length,
    v2:rows.filter(r=>r.arms.v2.score.pass&&!r.arms.v1.score.pass).length,
    bothPass:rows.filter(r=>r.arms.v1.score.pass&&r.arms.v2.score.pass).length,
    neitherPass:rows.filter(r=>!r.arms.v1.score.pass&&!r.arms.v2.score.pass).length
  };
  return {
    schema:'qortara/ci-triage-v1-v2-host-compare/1',
    state:actualProvider?'LIVE_TEXT_MODEL_OUTPUTS_RECORDED':'TEST_DOUBLE_NOT_HOST_EVIDENCE',
    providerModel:model,source:'ORIGINAL_TWO_SEALED_REAL_P0_GENERATED_SKILLS',
    packageHashes:{v1:sealed.v1.manifestSha256,v2:sealed.v2.manifestSha256},
    instructionHashes:{v1:sealed.v1.sha256,v2:sealed.v2.sha256},
    caseCount:c.length,modelCalls:c.length*2,
    testOraclesIndependentlyAdjudicated:false,
    modelHostOriginIndependentlyAttested:false,
    hostSkillsNativelyInstalled:false,
    hostBehaviorObserved:actualProvider,
    modelInferenceDuringBuild:'NOT_INSTRUMENTED_HERE',
    sourceRightsQualified:false,prismTrustApproved:false,productionEligible:false,
    scores:results,pairedOutcomes:wins,rows
  };
}
export async function main(args=process.argv.slice(2)){
  const values={};
  for(let i=0;i<args.length;i+=2){
    if(!['--v1-dir','--v2-dir','--model','--report'].includes(args[i])||
      !args[i+1]||Object.hasOwn(values,args[i]))
      refuse('PAIR_USAGE','required --v1-dir DIR --v2-dir DIR --model ID --report NEW.json');
    values[args[i]]=args[i+1];
  }
  if(Object.keys(values).length!==4)refuse('PAIR_USAGE','four explicit parameters required');
  const token=process.env.OPENAI_API_KEY;
  if(typeof token!=='string'||token.length<10)
    refuse('PAIR_AUTH','owner-approved provider key required');
  const raw=await readFile(new URL('../tests/fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url));
  const cases=JSON.parse(raw.toString('utf8'));
  const report=resolve(values['--report']);
  const partial=report+'.partial.jsonl';
  await writeFile(partial,'',{flag:'wx',mode:0o600});
  const result=await compareSealedSkills({
    v1Dir:resolve(values['--v1-dir']),v2Dir:resolve(values['--v2-dir']),
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
