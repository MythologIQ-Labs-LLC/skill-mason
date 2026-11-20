#!/usr/bin/env node
/**
 * No-key review of source-pinned public trial responses.
 * No model, signer, Prism, network or skills installation.
 *
 * --mode packet emits reviewer-only cases without arm labels.
 * --mode bindings emits PRIVATE operator mapping and retained hashes.
 * --mode adjudicate verifies both and all 32 evidence-backed judgments.
 */
import {readFile,lstat} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
 preparePublicBlindReview,adjudicatePublicBlindReview
} from '../src/evaluation/four-arm-blind-review.mjs';

const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
async function boundedFile(path,limit=2_000_000){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))
  fail('REVIEW_PATH','absolute local file path required');
 const stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>limit)
  fail('REVIEW_PATH','bounded ordinary local file required, no symlinks');
 return readFile(path,'utf8');
}
async function readJson(path){return JSON.parse(await boundedFile(path));}
async function readSeed(path){
 const raw=await boundedFile(path,66);
 const value=raw.trim();
 if(!/^[a-f0-9]{64}$/.test(value))
  fail('REVIEW_SEED','seed must be an independently retained lowercase 256-bit hex string');
 return value;
}
function opts(argv){
 const values={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!key?.startsWith('--')||typeof value!=='string'||!value||
     Object.hasOwn(values,key))
   fail('REVIEW_USAGE','expected unique --name value pairs');
  values[key]=value;
 }
 const mode=values['--mode'];
 const base=['--mode','--responses','--seed'];
 const extra=['--packet','--mapping','--judgments','--packet-sha256','--mapping-sha256'];
 if(!['packet','bindings','adjudicate'].includes(mode)||
    argv.length!==(mode==='adjudicate'?16:6)||
    Object.keys(values).sort().join('|')!==[...base,...(mode==='adjudicate'?extra:[])].sort().join('|'))
  fail('REVIEW_USAGE',
   'usage: --mode packet|bindings --responses ABS --seed ABS; adjudicate adds --packet ABS --mapping ABS --judgments ABS --packet-sha256 HASH --mapping-sha256 HASH');
 return values;
}
export async function execute(argv){
 const a=opts(argv);
 const responses=await readJson(a['--responses']);
 const reviewSeed=await readSeed(a['--seed']);
 if(a['--mode']==='packet'){
  const result=await preparePublicBlindReview({responses,reviewSeed});
  return result.packet;
 }
 if(a['--mode']==='bindings'){
  const result=await preparePublicBlindReview({responses,reviewSeed});
  return {state:'PRIVATE_OPERATOR_ONLY_NOT_FOR_REVIEWER',
   packetSha256:result.packetSha256,
   mappingSha256:result.mappingSha256,
   mapping:result.mapping};
 }
 return adjudicatePublicBlindReview({
  responses,reviewSeed,packet:await readJson(a['--packet']),
  mapping:await readJson(a['--mapping']),
  judgments:await readJson(a['--judgments']),
  expectedPacketSha256:a['--packet-sha256'],
  expectedMappingSha256:a['--mapping-sha256']
 });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const result=await execute(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result?.schema==='qortara/public-four-arm-quality-adjudication/1'&&
     Object.values(result.summary).some(x=>x.fail>0||x.unknown>0))
   process.exitCode=2;
 }catch(e){
  process.stderr.write(JSON.stringify({state:'REFUSED',
   code:e?.code??'REVIEW_ERROR',message:String(e?.message??e),
   reviewerIndependenceAuthenticated:false,productionEligible:false})+'\n');
  process.exitCode=2;
 }
}
