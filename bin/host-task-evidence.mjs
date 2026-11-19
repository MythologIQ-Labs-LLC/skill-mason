#!/usr/bin/env node
/**
 * Local, offline operator evidence intake. No network, model invocation,
 * skill installation, remote log reads, or automated approval.
 * Record files hold digests/labels only; raw transcripts remain local.
 */
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPackage} from '../src/backend/compose.mjs';
import {captureHostTaskEvidence,verifyHostTaskEvidence} from '../src/backend/host-task-evidence.mjs';

const captureKeys=['--candidate-dir','--expected-package-sha256','--host','--model',
 '--session','--observed-at','--polarity','--prompt','--reference','--response','--out'];
const verifyKeys=['--candidate-dir','--expected-package-sha256',
 '--prompt','--reference','--response','--record'];
const refuse=(code,message)=>{throw Object.assign(new Error(message),{code});};

export function parseArgs(argv){
 if(!Array.isArray(argv)||!['capture','verify'].includes(argv[0]))
  refuse('USAGE','usage: capture|verify with required explicit options');
 const mode=argv[0],keys=mode==='capture'?captureKeys:verifyKeys;
 const args={mode};
 for(let i=1;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!keys.includes(key)||Object.hasOwn(args,key)||
     typeof value!=='string'||value.length===0||value.startsWith('--'))
   refuse('USAGE','missing, unknown or duplicate option '+String(key));
  args[key]=value;
 }
 if(keys.some(k=>!Object.hasOwn(args,k)))
  refuse('USAGE','all '+mode+' options are required; no implied authority or missing evidence');
 return args;
}
async function bytesFromFile(path,label,{max=96*1024}={}){
 if(typeof path!=='string'||path.length>4096)
  refuse('EVIDENCE_PATH','invalid local '+label+' file path');
 let st;
 try{st=await lstat(path);}
 catch{refuse('EVIDENCE_PATH','missing local '+label+' file');}
 if(!st.isFile()||st.isSymbolicLink()||st.size>max)
  refuse('EVIDENCE_PATH','real bounded regular file required for '+label);
 const b=await readFile(path);
 if(b.length>max)refuse('EVIDENCE_PATH','evidence file changed while reading: '+label);
 return b;
}
export async function execute(argv){
 const opts=parseArgs(argv);
 const candidateDir=opts['--candidate-dir'];
 const expectedPackageSha256=opts['--expected-package-sha256'];
 const packageValue=await readPackage(candidateDir); // exact completion seal first
 const [prompt,reference,response]=await Promise.all([
  bytesFromFile(opts['--prompt'],'prompt'),
  bytesFromFile(opts['--reference'],'reference'),
  bytesFromFile(opts['--response'],'response')
 ]);
 if(opts.mode==='capture'){
  const record=captureHostTaskEvidence({
   packageValue,trustedManifestSha256:expectedPackageSha256,
   host:{provider:opts['--host'],model:opts['--model'],
    sessionId:opts['--session'],observedAt:opts['--observed-at']},
   polarity:opts['--polarity'],prompt,reference,response
  });
  // Never overwrite another observation. The file is metadata-only,
  // restricted to the invoking operator; no transcript bytes are persisted.
  await writeFile(opts['--out'],JSON.stringify(record,null,2)+'\n',
   {flag:'wx',mode:0o600});
  return {state:record.state,recordPath:resolve(opts['--out']),
   candidate:record.candidate,scenario:record.scenario,
   hostProvider:record.host.provider,hostValidated:false,productionEligible:false};
 }
 const recordBytes=await bytesFromFile(opts['--record'],'record',{max:64*1024});
 let record;
 try{record=JSON.parse(recordBytes.toString('utf8'));}
 catch{refuse('RECORD_SCHEMA','invalid JSON host-task record');}
 return verifyHostTaskEvidence({record,packageValue,
  trustedManifestSha256:expectedPackageSha256,prompt,reference,response});
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 execute(process.argv.slice(2)).then(result=>{
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }).catch(err=>{
  process.stderr.write(JSON.stringify({
   code:err?.code??'HOST_EVIDENCE_FAILURE',
   message:String(err?.message??err),
   hostValidated:false,productionEligible:false
  })+'\n');
  process.exitCode=2;
 });
}
