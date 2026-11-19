#!/usr/bin/env node
/**
 * Bounded user-request -> original first-party method -> real Prism P0 ->
 * complete, sealed Agent Skills development candidate.
 *
 * The user explicitly selects a supported capability and original method.
 * The request is NEVER interpreted as permission, source evidence, or host
 * instruction. The existing signed-ephemeral P0 fixture remains NON-PRODUCTION.
 */
import {createHash} from 'node:crypto';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PILOT_DEFINITIONS,PILOT_HOST,PILOT_CURRENT_SNAPSHOT_COMMIT}
  from '../src/backend/first-party-pilots.mjs';
import {runFirstPartyPilot,DEV_HOLO_SHA256} from './first-party-pilot.mjs';

export const REQUEST_SCHEMA='qortara/first-party-request-to-candidate/1';
const CONTROL=/[\x00-\x1f\x7f]/;
const sha=x=>createHash('sha256').update(x).digest('hex');
function fail(code,message){throw Object.assign(new Error(message),{code});}

export function bindFirstPartyRequest({request,capability,methodId,host}={}){
  if(typeof request!=='string'||request!==request.normalize('NFC')||
     request.trim()!==request||request.length<24||request.length>1000||
     CONTROL.test(request)||request.split(/\s+/).length<5)
    fail('REQUEST_INVALID','a bounded single-line NFC task request with an observable outcome is required');
  if(typeof capability!=='string'||capability.length>160)
    fail('CAPABILITY_REQUIRED','choose an explicit supported first-party outcome');
  const selected=PILOT_DEFINITIONS.find(x=>x.outcome===capability);
  if(!selected)fail('CAPABILITY_UNSUPPORTED','the requested capability has no original first-party procedure');
  if(methodId!==selected.id)
    fail('METHOD_MISMATCH','the explicitly selected original method does not cover the declared capability');
  if(host!==PILOT_HOST)
    fail('HOST_UNSUPPORTED','only the text-only development fixture is supported; a real host must be qualified separately');
  // Recording exact user intent as a hash preserves privacy and prevents
  // free-form text from becoming a source, package instruction or signed fact.
  return Object.freeze({methodId:selected.id,capability:selected.outcome,host,
    requestSha256:sha(Buffer.from(request,'utf8')),requestTextNotEmbedded:true,
    requestSemanticMatchVerified:false,userSelectedMethodExplicitly:true,
    admittedSourceRights:false});
}

export async function generateFirstPartyRequest({
  request,capability,methodId,host,holoPath,holoSha256,
  outputRoot,devP0Fixture,loadRuntime
}={}){
  // Fail before contacting Prism, reading source bytes, or creating output.
  const binding=bindFirstPartyRequest({request,capability,methodId,host});
  if(devP0Fixture!==true)
    fail('FIXTURE_CONSENT','explicit --dev-p0-fixture required for synthetic facts');
  if(typeof holoPath!=='string'||!isAbsolute(holoPath)||
     holoSha256!==DEV_HOLO_SHA256)
    fail('PILOT_PIN','only the exact original native development holo is supported');
  if(typeof outputRoot!=='string'||!isAbsolute(outputRoot))
    fail('OUTPUT_ROOT','absolute existing output parent required');
  const candidate=await runFirstPartyPilot({
    id:binding.methodId,holoPath,holoSha256,outputRoot,
    devP0Fixture:true,...(loadRuntime?{loadRuntime}:{})
  });
  if(candidate?.status!=='DEVELOPMENT_CANDIDATE'||
     candidate.id!==binding.methodId||
     candidate.sourceCommit!==PILOT_CURRENT_SNAPSHOT_COMMIT||
     candidate.holoSha256!==DEV_HOLO_SHA256||
     candidate.hostValidated!==false||
     candidate.modelCallsMeasured!==false||
     candidate.productionEligible!==false||
     candidate.signedEvidence!=='SYNTHETIC_EPHEMERAL_TEST_ONLY'||
     candidate.sourceLegalRights!=='NOT_REVIEWED_FOR_DISTRIBUTION')
    fail('PILOT_PROMOTION','a development candidate attempted to assert qualified output');
  return {
    schema:REQUEST_SCHEMA,state:'GENERATED_UNQUALIFIED_SEALED_SKILL',
    requestedOutcome:binding.capability,requestSha256:binding.requestSha256,
    selectedMethod:binding.methodId,hostLabelNotHostApproval:binding.host,
    originalSourceCommit:candidate.sourceCommit,
    methodSelection:'EXPLICIT_USER_SELECTION_NOT_SEMANTIC_INFERENCE',
    requestTextNotEmbedded:true,requestSemanticMatchVerified:false,
    sourceRightsVerified:false,hostBehaviorValidated:false,
    prismInvoked:true,prismAssurance:'P0 unverified',
    evidence:'SYNTHETIC_EPHEMERAL_TEST_ONLY',
    originalHoloSha256:candidate.holoSha256,
    packageManifestSha256:candidate.artifactSha256,
    output:candidate.output,
    endToEndInferenceTokensMeasured:false,
    productionEligible:false
  };
}
export function parseRequestArgs(argv){
  if(!Array.isArray(argv))fail('USAGE','argument list required');
  const allowed=new Set(['--request','--capability','--method','--host',
    '--holo','--sha256','--output-root']);
  const x={};let flag=false;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--dev-p0-fixture'){
      if(flag)fail('USAGE','duplicate development consent');
      flag=true;continue;
    }
    const key=argv[i];
    if(!allowed.has(key)||Object.hasOwn(x,key))fail('USAGE','unexpected or duplicate argument '+key);
    const value=argv[++i];
    if(typeof value!=='string'||value.startsWith('--'))
      fail('USAGE','argument missing value: '+key);
    x[key]=value;
  }
  if(!flag||[...allowed].some(k=>!Object.hasOwn(x,k)))
    fail('USAGE','required: --request --capability --method --host --holo --sha256 --output-root --dev-p0-fixture');
  return {request:x['--request'],capability:x['--capability'],methodId:x['--method'],
    host:x['--host'],holoPath:x['--holo'],holoSha256:x['--sha256'],
    outputRoot:x['--output-root'],devP0Fixture:true};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    const result=await generateFirstPartyRequest(parseRequestArgs(process.argv.slice(2)));
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(err){
    process.stderr.write(JSON.stringify({schema:REQUEST_SCHEMA,
      state:'REFUSED',code:err?.code??'REQUEST_PILOT_FAILED',
      message:String(err?.message??err),productionEligible:false})+'\n');
    process.exitCode=2;
  }
}
