#!/usr/bin/env node
/** No-key public trial with original source bytes; no signed source approval. */
import {readFile,lstat} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
 buildPublicFourArmTrial,scorePublicFourArmTrial
} from '../src/evaluation/public-four-arm-trial.mjs';

function refuse(code,message){throw Object.assign(new Error(message),{code});}
async function readResponses(path){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))
  refuse('INPUT_PATH','absolute response file path required');
 const s=await lstat(path);
 if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>1_000_000)
  refuse('INPUT_PATH','bounded ordinary JSON response file required');
 return JSON.parse(await readFile(path,'utf8'));
}
export async function execute(args){
 if(Array.isArray(args)&&args.length===1&&args[0]==='--prepare')
  return await buildPublicFourArmTrial();
 if(Array.isArray(args)&&args.length===2&&args[0]==='--score')
  return await scorePublicFourArmTrial({responses:await readResponses(args[1])});
 refuse('USAGE','usage: --prepare OR --score /absolute/path/recorded-four-arm-responses.json');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const result=await execute(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result?.state==='RECORDED_PREVIEW_TRIAL_SCORED_UNATTESTED'&&
     Object.values(result.summary).some(x=>x.failed>0))process.exitCode=2;
 }catch(e){
  process.stderr.write(JSON.stringify({state:'REFUSED',
   code:e?.code??'TRIAL_FAILED',message:String(e?.message??e),
   sourceRightsApproved:false,productionEligible:false})+'\n');
  process.exitCode=2;
 }
}
