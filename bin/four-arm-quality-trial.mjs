#!/usr/bin/env node
/**
 * Manual, no-API-key four-arm agent trial.
 * This CLI never calls a model, installs skills or writes repository files.
 * It only emits prompts or compares independently captured raw answers.
 */
import {readFile,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {readPackage} from '../src/backend/compose.mjs';
import {prepareFourArmPrompts,scoreFourArmTrial}
 from '../src/evaluation/ci-release-combined-score.mjs';

const ARMS=['baseline','ci_only','release_only','combined'];
const refuse=(code,message)=>{throw Object.assign(new Error(message),{code});};
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,fields){
 return plain(x)&&Object.keys(x).sort().join('|')===[...fields].sort().join('|');
}
async function loadJSON(path){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))
  refuse('TRIAL_PATH','absolute local input paths only');
 const info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>1_000_000)
  refuse('TRIAL_PATH','bounded ordinary files only, no symlinks');
 return JSON.parse(await readFile(path,'utf8'));
}
async function main(args){
 if(args.length!==4||args[0]!=='--mode'||!['prepare','score'].includes(args[1])||
  args[2]!=='--input')
  refuse('TRIAL_USAGE','usage: --mode prepare|score --input /absolute/four-arm-trial.json');
 const config=await loadJSON(args[3]);
 if(!exact(config,['schema','caseFile','artifacts','responses'])||
  config.schema!=='qortara/four-arm-trial-input/1'||
  !exact(config.artifacts,ARMS)||!exact(config.responses,ARMS))
  refuse('TRIAL_INPUT','exact four-arm input schema required');
 if(config.artifacts.baseline!==null||config.responses.baseline===undefined)
  refuse('TRIAL_INPUT','baseline must not have a skill package and must declare its response file');
 const artifacts={baseline:null};
 for(const arm of ARMS.slice(1)){
  const item=config.artifacts[arm];
  if(!exact(item,['candidateDir','expectedManifestSha256'])||
   typeof item.candidateDir!=='string'||!isAbsolute(item.candidateDir))
   refuse('TRIAL_INPUT','every skill arm needs explicit sealed directory and independent manifest digest');
  artifacts[arm]={candidate:await readPackage(item.candidateDir),
   expectedManifestSha256:item.expectedManifestSha256};
 }
 const cases=await loadJSON(config.caseFile);
 if(args[1]==='prepare'){
  console.log(JSON.stringify(prepareFourArmPrompts({cases,artifacts}),null,2));
  return;
 }
 const arms={};
 for(const arm of ARMS)arms[arm]=await loadJSON(config.responses[arm]);
 const result=scoreFourArmTrial({cases,arms,artifacts});
 console.log(JSON.stringify(result,null,2));
 // Do not call a four-arm 'winning' score a failed process. Exit nonzero only
 // on absent, altered or structurally failed cases, not relative superiority.
 if(Object.values(result.summary).some(x=>x.failed>0))process.exitCode=2;
}
main(process.argv.slice(2)).catch(error=>{
 console.error(JSON.stringify({state:'REFUSED',code:error?.code??'TRIAL_ERROR',
  message:String(error?.message??error),
  independentHostOriginAttested:false,productionEligible:false}));
 process.exitCode=2;
});
