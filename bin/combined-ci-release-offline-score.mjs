#!/usr/bin/env node
/**
 * Offline scorer for raw agent replies to the two-method CI/release task set.
 * No model API, network, host installation, signer or repository write access.
 * The expected manifest SHA must be independently retained by the operator.
 */
import {readFile,stat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {readPackage} from '../src/backend/compose.mjs';
import {scoreCombinedTrial} from '../src/evaluation/ci-release-combined-score.mjs';

const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
async function jsonAt(path){
 if(!isAbsolute(path))fail('TRIAL_PATH','expected absolute local input file path');
 const info=await stat(path);
 if(!info.isFile()||info.size<=0||info.size>512_000)
  fail('TRIAL_PATH','only bounded existing JSON input files are supported');
 return JSON.parse(await readFile(path,'utf8'));
}
async function main(args){
 const required=['--candidate-dir','--expected-package-sha256','--cases','--responses'];
 if(args.length!==8||new Set(args.filter((_,i)=>i%2===0)).size!==4||
    required.some(k=>!args.includes(k)))
  fail('TRIAL_USAGE','usage: --candidate-dir ABS --expected-package-sha256 SHA256 --cases ABS --responses ABS');
 const opt=Object.fromEntries([0,2,4,6].map(i=>[args[i],args[i+1]]));
 if(!isAbsolute(opt['--candidate-dir']))
  fail('TRIAL_PATH','candidate directory must be an absolute path');
 const candidate=await readPackage(opt['--candidate-dir']);
 const cases=await jsonAt(opt['--cases']);
 const responses=await jsonAt(opt['--responses']);
 const result=scoreCombinedTrial({
  candidate,expectedManifestSha256:opt['--expected-package-sha256'],
  cases,responses
 });
 console.log(JSON.stringify(result,null,2));
 if(result.failed>0)process.exitCode=2;
}
main(process.argv.slice(2)).catch(e=>{
 console.error(JSON.stringify({
  state:'REFUSED',code:e?.code??'TRIAL_ERROR',message:String(e?.message??e),
  independentHostOriginAttested:false,productionEligible:false
 }));
 process.exitCode=2;
});
