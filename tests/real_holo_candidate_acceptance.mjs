#!/usr/bin/env node
/**
 * Execute an actual pinned P0 holo through the existing Prism consumer inside
 * a credential-free, disposable CI runner. Source and rights facts in this
 * test are SYNTHETIC, signed with an ephemeral local test key.
 *
 * This is NOT source-rights acceptance, P2 proof or real host validation.
 */
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';
import {createComposer,canonicalJSON,verifyPackage,writePackage,readPackage} from '../src/backend/compose.mjs';
import {evaluate,loadPinnedRuntime} from '../bin/qortara-skills.mjs';

const PIN='9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e';
const DOMAIN='QORTARA-METHOD-ASSERTION-V1\n';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const CLOCK=1784419200;
function fixtureMethod(){
 const text='Record the explicit code changes and the test results before proposing a review conclusion.';
 const packageBytes=Buffer.from('# First-party development fixture\n\n'+text+'\n','utf8');
 return {
  method_id:'review-explicit-changes',package_id:'fixture/review-explicit-changes',
  package_sha256:SHA(packageBytes),packageBytes,
  method:{
   id:'review-explicit-changes',origin:'https://example.test/dev-fixture-only',
   sourcePath:'fixtures/review-explicit-changes.md',
   commit:'a'.repeat(40),sha256:SHA(Buffer.from(text)),
   methodVersion:'fixture-v1',methodText:text,covers:['record reviewed changes'],
   containsAssets:false
  }
 };
}
function fixtureRecipe(entry){
 return {schema_version:'skill-mason.recipe.v0',skill_id:'review-changes',
 title:'Review changes',description:'Record code changes and observed test results.',
 target_host:'offline-development-fixture',required_outcomes:['record reviewed changes'],
 source_snapshot:{repository:'https://example.test/not-a-qualified-catalog',
  commit:'b'.repeat(40),sha256:'c'.repeat(64)},
 components:[{method_id:entry.method_id,package_id:entry.package_id,package_sha256:entry.package_sha256}],
 authority:{network:false,secrets:false,execution:false}};
}
async function signedAssertions({deniedRights=false}={}){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pem=publicKey.export({type:'spki',format:'pem'}).toString('utf8');
 const keySha=SHA(publicKey.export({type:'spki',format:'der'}));
 const evidence=Object.fromEntries(['evidence','rights','authority','coverage']
  .map(k=>[k,Buffer.from('development fixture evidence for '+k)]));
 const evidenceDigests=Object.fromEntries(Object.entries(evidence).map(([k,b])=>[k,SHA(b)]));
 return createSignedAssertionAdapter({
  trust:{schema:'qortara/method-assertion-trust/1',issuer:'fixture.test-only',
   keyId:'ephemeral-01',publicKeyPem:pem,publicKeySha256:keySha,
   policyRevision:'dev-fixture-v1',
   revocations:{validFrom:CLOCK-600,expiresAt:CLOCK+600,proofDigests:[]}},
  loadEnvelope:async subjectSha256=>{
   const rights=!deniedRights;
   const payload={schema:'qortara/method-assertion/1',issuer:'fixture.test-only',
    keyId:'ephemeral-01',policyRevision:'dev-fixture-v1',
    subjectSha256,validFrom:CLOCK-60,expiresAt:CLOCK+60,
    facts:{evidence:true,rights,authority:true,coverage:true},
    evidenceDigests:{...evidenceDigests,rights:rights?evidenceDigests.rights:null}};
   return {schema:'qortara/signed-method-assertion/1',payload,
    signature:sign(null,Buffer.from(DOMAIN+canonicalJSON(payload)),privateKey).toString('base64url')};
  },
  readEvidence:async({field})=>evidence[field],nowEpoch:()=>CLOCK
 });
}
async function main(argv){
 if(argv.length!==6||argv[0]!=='--holo'||argv[2]!=='--sha256'||argv[4]!=='--report')
   throw new Error('Usage: --holo ABSOLUTE --sha256 KNOWN_PIN --report NEW.json');
 const [ ,holoPath, ,sha256, ,report]=argv;
 if(!isAbsolute(holoPath)||sha256!==PIN||!isAbsolute(report))
   throw new Error('Only the exact recorded P0 holo pin and absolute paths are permitted');
 const holoBytes=await readFile(holoPath);
 assert.equal(holoBytes.length,17346,'unexpected compiler candidate size');
 assert.equal(SHA(holoBytes),PIN,'compiled holo bytes differ from recorded manifest');
 const runtime=await loadPinnedRuntime(); // real pinned prism-code@0.9.5, no mock
 let guestCalls=0;
 async function runPrism({requestHex,holoSha256}){
  assert.equal(holoSha256,PIN);
  guestCalls++;
  return evaluate({'--holo':holoPath,'--sha256':PIN,'--hex':requestHex},async()=>runtime);
 }
 const entry=fixtureMethod(),recipe=fixtureRecipe(entry);
 const adapt=createRecipeAdapter({sourceSnapshot:recipe.source_snapshot,
  supportedHosts:['offline-development-fixture'],components:[entry]});
 const {plan,methods}=adapt(recipe);
 const assertMethod=await signedAssertions();
 const compose=createComposer({assertMethod,runPrism,holoSha256:PIN});
 const dir=await mkdtemp(join(tmpdir(),'qortara-real-holo-candidate-'));
 try{
  const candidate=await compose(plan,methods);
  const verification=verifyPackage(candidate);
  assert.equal(candidate.status,'DEVELOPMENT_CANDIDATE');
  assert.equal(JSON.parse(candidate.files['RECEIPT.json']).productionEligible,false);
  assert.equal(JSON.parse(candidate.files['RECEIPT.json']).hostValidated,false);
  assert.equal(JSON.parse(candidate.files['RECEIPT.json']).modelCallsMeasured,false);
  const receipt=JSON.parse(candidate.files['RECEIPT.json']);
  assert.equal(receipt.assertions[0].verdict.guestSha256,PIN);
  assert.equal(receipt.assertions[0].verdict.responseHex,'656c696769626c65');
  const destination=join(dir,'candidate');
  await writePackage(candidate,destination);
  assert.deepEqual(await readPackage(destination),candidate);
  const repeat=await compose(plan,methods);
  assert.deepEqual(candidate,repeat,'identical inputs must produce identical candidate bytes');
  // A separately signed denial must reach the *actual* guest and refuse.
  const negativeCompose=createComposer({assertMethod:await signedAssertions({deniedRights:true}),
    runPrism,holoSha256:PIN});
  let denied=false,deniedCode=null;
  try{await negativeCompose(plan,methods);}
  catch(err){denied=true;deniedCode=err.code;
   assert.equal(err.code,'PRISM_REFUSED');
   assert.match(err.message,/RIGHTS_UNRESOLVED/);
  }
  assert.equal(denied,true,'signed rights denial must not become a package');
  assert.equal(guestCalls,3,'two eligible and one denied call must reach the real guest');
  const record={schema:'qortara/real-holo-candidate-pilot/1',source:'ephemeral-tests-only',
   subjectHoloSha256:PIN,guest:'prism-code@0.9.5',guestCalls,
   sourceRights:'SYNTHETIC_FIXTURE_NOT_LEGAL_AUTHORIZATION',assurance:'P0 unverified',
   signedProof:'EPHEMERAL_FIXTURE_KEY',productionEligible:false,hostValidated:false,
   modelCallsMeasured:false,decisionPositive:'eligible',decisionNegative:'refused: RIGHTS_UNRESOLVED',
   negativeComposerRefusal:deniedCode,
   candidateManifestSha256:verification.packageSha256,
   replay:'BYTE_IDENTICAL_WITHIN_RUN',diskReadback:'INTEGRITY_VERIFIED'};
  await writeFile(report,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(record,null,2));
 }finally{await rm(dir,{recursive:true,force:true});}
}
main(process.argv.slice(2)).catch(err=>{
 console.error(JSON.stringify({code:err?.code??'PILOT_FAILURE',message:String(err?.message??err)}));
 process.exitCode=1;
});
