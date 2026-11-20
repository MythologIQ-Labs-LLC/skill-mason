#!/usr/bin/env node
/**
 * Local, offline operator evidence intake. No network, model invocation,
 * skill installation, remote log reads, or automated approval.
 * Record files hold digests/labels only; raw transcripts remain local.
 */
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPackage} from '../src/backend/compose.mjs';
import {captureHostTaskEvidence,verifyHostTaskEvidence,inspectHostTaskMatrix,inspectHostTaskPair} from '../src/backend/host-task-evidence.mjs';

const captureKeys=['--candidate-dir','--expected-package-sha256','--host','--model',
 '--session','--observed-at','--polarity','--prompt','--reference','--response','--out'];
const verifyKeys=['--candidate-dir','--expected-package-sha256',
 '--prompt','--reference','--response','--record'];
const matrixKeys=['--manifest','--out'];
const pairKeys=['--manifest','--out'];
const refuse=(code,message)=>{throw Object.assign(new Error(message),{code});};

export function parseArgs(argv){
 if(!Array.isArray(argv)||!['capture','verify','matrix','pair'].includes(argv[0]))
  refuse('USAGE','usage: capture|verify|matrix|pair with required explicit options');
 const mode=argv[0],
  keys=mode==='capture'?captureKeys:mode==='verify'?verifyKeys:mode==='pair'?pairKeys:matrixKeys;
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
 if(opts.mode==='matrix'||opts.mode==='pair'){
  const raw=await bytesFromFile(opts['--manifest'],'operator host-evidence manifest',{max:32*1024});
  let spec;
  try{spec=JSON.parse(raw.toString('utf8'));}
  catch{refuse('MATRIX_SCHEMA','invalid operator manifest JSON');}
  const expected=['candidateDir','expectedPackageSha256',
   'record','prompt','reference','response'];
  const isPair=opts.mode==='pair';
  const expectedSchema=isPair?'qortara/operator-host-pair-input/1':
    'qortara/operator-host-matrix-input/1';
  const count=isPair?2:4;
  if(!spec||typeof spec!=='object'||Array.isArray(spec)||
     Object.keys(spec).sort().join('|')!=='cases|schema'||
     spec.schema!==expectedSchema||
     !Array.isArray(spec.cases)||spec.cases.length!==count)
    refuse(isPair?'PAIR_SCHEMA':'MATRIX_SCHEMA',
      'exact '+count+' locally custodied case definitions required');
  const cases=[];
  for(const entry of spec.cases){
   if(!entry||typeof entry!=='object'||Array.isArray(entry)||
      Object.keys(entry).sort().join('|')!==expected.sort().join('|')||
      expected.some(k=>typeof entry[k]!=='string'||!entry[k]||
        (k!=='expectedPackageSha256'&&!isAbsolute(entry[k]))))
    refuse(isPair?'PAIR_SCHEMA':'MATRIX_SCHEMA','exact local absolute paths and independent package pin required');
   const [packageValue,prompt,reference,response,recordBytes]=await Promise.all([
    readPackage(entry.candidateDir),
    bytesFromFile(entry.prompt,'prompt'),
    bytesFromFile(entry.reference,'reference'),
    bytesFromFile(entry.response,'response'),
    bytesFromFile(entry.record,'record',{max:64*1024})
   ]);
   let record;
   try{record=JSON.parse(recordBytes.toString('utf8'));}
   catch{refuse(isPair?'PAIR_SCHEMA':'MATRIX_SCHEMA','invalid case record JSON');}
   cases.push({packageValue,record,prompt,reference,response,
    trustedManifestSha256:entry.expectedPackageSha256});
  }
  const result=isPair?inspectHostTaskPair(cases):inspectHostTaskMatrix(cases);
  await writeFile(opts['--out'],JSON.stringify(result,null,2)+'\n',
   {flag:'wx',mode:0o600});
  return {...result,outputPath:resolve(opts['--out'])};
 }
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
