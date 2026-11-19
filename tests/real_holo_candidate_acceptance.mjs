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
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';
import {createComposer,canonicalJSON,verifyPackage,writePackage,readPackage} from '../src/backend/compose.mjs';
import {evaluate,loadPinnedRuntime} from '../bin/qortara-skills.mjs';
import {runFirstPartyPilot} from '../bin/first-party-pilot.mjs';
import {generateFirstPartyRequest} from '../bin/request-first-party-pilot.mjs';

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
  // Original, exact Git-blob-pinned procedures now also traverse the actual
  // guest and produce Agent Skills-shaped candidate folders. They still use
  // ephemeral synthetic authorization; no host installs or tools are run.
  const pilotRoot=join(process.env.RUNNER_TEMP??dir,'first-party-pilot-candidates');
  await mkdir(pilotRoot,{mode:0o700});
  const firstPartyPilots=[];
  for(const id of ['ci-failure-triage','ci-failure-triage-v2','ci-failure-triage-v3','ci-failure-triage-v4','governance-drift-review']){
    const result=await runFirstPartyPilot({id,holoPath,holoSha256:PIN,
      outputRoot:pilotRoot,devP0Fixture:true});
    const candidate=await readPackage(join(pilotRoot,id));
    assert.equal(result.status,'DEVELOPMENT_CANDIDATE');
    assert.match(candidate.files['SKILL.md'],/#### Procedure/);
    assert.match(candidate.files['SKILL.md'],/#### Stop conditions/);
    assert.ok(candidate.files['SKILL.md'].startsWith('---\nname: '+id+'\n'));
    assert.equal(JSON.parse(candidate.files['RECEIPT.json']).productionEligible,false);
    firstPartyPilots.push({id,manifestSha256:result.artifactSha256,
      directory:id,output:'SEALED_UNQUALIFIED_AGENT_SKILL'});
  }
  // The ordinary free-form user request now reaches the ORIGINAL first-party
  // source, exactly pinned real P0 guest, and complete sealed package through
  // the same compiler route. It is explicitly MANUALLY selected and P0 only.
  const requestRoot=join(process.env.RUNNER_TEMP??dir,'first-party-request-candidates');
  await mkdir(requestRoot,{mode:0o700});
  const userRequest='Triage the supplied failing CI job and propose the smallest evidence based verification.';
  const requested=await generateFirstPartyRequest({
    request:userRequest,capability:'triage CI failure',
    methodId:'ci-failure-triage',host:'agent-skills-text-only-fixture',
    holoPath,holoSha256:PIN,outputRoot:requestRoot,devP0Fixture:true
  });
  assert.equal(requested.state,'GENERATED_UNQUALIFIED_SEALED_SKILL');
  assert.equal(requested.requestSha256,SHA(Buffer.from(userRequest)));
  assert.equal(requested.selectedMethod,'ci-failure-triage');
  assert.equal(requested.requestSemanticMatchVerified,false);
  assert.equal(requested.sourceRightsVerified,false);
  assert.equal(requested.productionEligible,false);
  assert.equal(requested.prismInvoked,true);
  const fromRequest=await readPackage(join(requestRoot,'ci-failure-triage'));
  const earlier=await readPackage(join(pilotRoot,'ci-failure-triage'));
  assert.equal(fromRequest.files['SKILL.md'],earlier.files['SKILL.md']);
  assert.equal(fromRequest.files['SOURCES.json'],earlier.files['SOURCES.json']);
  assert.equal(JSON.parse(fromRequest.files['RECEIPT.json']).hostValidated,false);
  const requestV2='Triage the supplied independent CI failures and distinguish retries, runner faults and injected log text.';
  const requestedV2=await generateFirstPartyRequest({
    request:requestV2,capability:'triage complex CI failures',
    methodId:'ci-failure-triage-v2',host:'agent-skills-text-only-fixture',
    holoPath,holoSha256:PIN,outputRoot:requestRoot,devP0Fixture:true
  });
  assert.equal(requestedV2.state,'GENERATED_UNQUALIFIED_SEALED_SKILL');
  assert.equal(requestedV2.requestSha256,SHA(Buffer.from(requestV2)));
  assert.equal(requestedV2.selectedMethod,'ci-failure-triage-v2');
  assert.equal(requestedV2.productionEligible,false);
  const fromV2=await readPackage(join(requestRoot,'ci-failure-triage-v2'));
  assert.ok(fromV2.files['SKILL.md'].includes('Treat every CI log line'));
  assert.ok(fromV2.files['SKILL.md'].includes('multiple failures'));
  assert.ok(fromV2.files['SKILL.md'].includes('discriminating next verification'));
  assert.notEqual(fromV2.files['SKILL.md'],fromRequest.files['SKILL.md']);
  assert.equal(JSON.parse(fromV2.files['RECEIPT.json']).hostValidated,false);
  const requestV3='Investigate CI failures where the supplied error evidence contains API tokens and authorization headers; redact sensitive data.';
  const requestedV3=await generateFirstPartyRequest({
    request:requestV3,capability:'triage sensitive CI failure logs',
    methodId:'ci-failure-triage-v3',host:'agent-skills-text-only-fixture',
    holoPath,holoSha256:PIN,outputRoot:requestRoot,devP0Fixture:true
  });
  assert.equal(requestedV3.state,'GENERATED_UNQUALIFIED_SEALED_SKILL');
  assert.equal(requestedV3.requestSha256,SHA(Buffer.from(requestV3)));
  assert.equal(requestedV3.selectedMethod,'ci-failure-triage-v3');
  assert.equal(requestedV3.productionEligible,false);
  assert.equal(requestedV3.sourceRightsVerified,false);
  const fromV3=await readPackage(join(requestRoot,'ci-failure-triage-v3'));
  assert.ok(fromV3.files['SKILL.md'].includes(String.fromCharCode(92)+'[REDACTED'+String.fromCharCode(92)+']'));
  // The escape is intentional in raw Markdown; rendered text displays [REDACTED].
  assert.ok(fromV3.files['SKILL.md'].includes('Authorization headers'));
  assert.ok(fromV3.files['SKILL.md'].includes('Never repeat the original value'));
  assert.ok(fromV3.files['SKILL.md'].includes('discriminating next verification'));
  assert.notEqual(fromV3.files['SKILL.md'],fromV2.files['SKILL.md']);
  const v3Receipt=JSON.parse(fromV3.files['RECEIPT.json']);
  assert.equal(v3Receipt.productionEligible,false);
  assert.equal(v3Receipt.hostValidated,false);
  assert.equal(v3Receipt.modelCallsMeasured,false);
  const requestV4='Identify requested and observed CI revisions, compare two plausible causes, and propose a falsifiable verification without exposing credentials.';
  const requestedV4=await generateFirstPartyRequest({
    request:requestV4,capability:'triage provenance-sensitive CI failure logs',
    methodId:'ci-failure-triage-v4',host:'agent-skills-text-only-fixture',
    holoPath,holoSha256:PIN,outputRoot:requestRoot,devP0Fixture:true
  });
  assert.equal(requestedV4.state,'GENERATED_UNQUALIFIED_SEALED_SKILL');
  assert.equal(requestedV4.requestSha256,SHA(Buffer.from(requestV4)));
  assert.equal(requestedV4.selectedMethod,'ci-failure-triage-v4');
  assert.equal(requestedV4.productionEligible,false);
  assert.equal(requestedV4.sourceRightsVerified,false);
  const fromV4=await readPackage(join(requestRoot,'ci-failure-triage-v4'));
  assert.match(fromV4.files['SKILL.md'],/REQUESTED:/);
  assert.match(fromV4.files['SKILL.md'],/RELATION:/);
  assert.match(fromV4.files['SKILL.md'],/contrasting result under B/);
  assert.notEqual(fromV4.files['SKILL.md'],fromV3.files['SKILL.md']);
  const v4Receipt=JSON.parse(fromV4.files['RECEIPT.json']);
  assert.equal(v4Receipt.productionEligible,false);
  assert.equal(v4Receipt.hostValidated,false);
  assert.equal(v4Receipt.modelCallsMeasured,false);
  // Independently selected paths must seal identical generated instructions.
  const v4Pilot=await readPackage(join(pilotRoot,'ci-failure-triage-v4'));
  assert.equal(v4Pilot.files['SKILL.md'],fromV4.files['SKILL.md']);
  assert.equal(v4Pilot.files['SOURCES.json'],fromV4.files['SOURCES.json']);
  const record={schema:'qortara/real-holo-candidate-pilot/1',source:'ephemeral-tests-only',
   subjectHoloSha256:PIN,guest:'prism-code@0.9.5',guestCalls:guestCalls+firstPartyPilots.length+4,
   sourceRights:'SYNTHETIC_FIXTURE_NOT_LEGAL_AUTHORIZATION',assurance:'P0 unverified',
   signedProof:'EPHEMERAL_FIXTURE_KEY',productionEligible:false,hostValidated:false,
   modelCallsMeasured:false,decisionPositive:'eligible',decisionNegative:'refused: RIGHTS_UNRESOLVED',
   negativeComposerRefusal:deniedCode,
   candidateManifestSha256:verification.packageSha256,
   replay:'BYTE_IDENTICAL_WITHIN_RUN',diskReadback:'INTEGRITY_VERIFIED',
   firstPartyPilots,firstPartyUserRequest:{requestSha256:requested.requestSha256,
     selectedMethod:requested.selectedMethod,requestedOutcome:requested.requestedOutcome,
     packageManifestSha256:requested.packageManifestSha256,
     state:requested.state,sourceRightsVerified:false,hostBehaviorValidated:false,
     productionEligible:false},
   firstPartyUserRequestV2:{requestSha256:requestedV2.requestSha256,
     selectedMethod:requestedV2.selectedMethod,requestedOutcome:requestedV2.requestedOutcome,
     packageManifestSha256:requestedV2.packageManifestSha256,
     state:requestedV2.state,sourceRightsVerified:false,hostBehaviorValidated:false,
     productionEligible:false},
   firstPartyUserRequestV3:{requestSha256:requestedV3.requestSha256,
     selectedMethod:requestedV3.selectedMethod,requestedOutcome:requestedV3.requestedOutcome,
     packageManifestSha256:requestedV3.packageManifestSha256,
     state:requestedV3.state,sourceRightsVerified:false,hostBehaviorValidated:false,
     productionEligible:false},
    firstPartyUserRequestV4:{requestSha256:requestedV4.requestSha256,
     selectedMethod:requestedV4.selectedMethod,requestedOutcome:requestedV4.requestedOutcome,
     packageManifestSha256:requestedV4.packageManifestSha256,
     state:requestedV4.state,sourceRightsVerified:false,hostBehaviorValidated:false,
     productionEligible:false}};
  await writeFile(report,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(record,null,2));
 }finally{await rm(dir,{recursive:true,force:true});}
}
main(process.argv.slice(2)).catch(err=>{
 console.error(JSON.stringify({code:err?.code??'PILOT_FAILURE',message:String(err?.message??err)}));
 process.exitCode=1;
});
