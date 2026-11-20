/** The real original v2 source travels through two ephemeral, independent
 * Ed25519 fixtures and a mock Prism runtime. No real rights or host acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {composeOperatorBoundP0} from '../src/backend/operator-source-composition.mjs';
import {canonicalJSON,readPackage,verifyPackage} from '../src/backend/compose.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_HOST,
  PILOT_RELEASE_V2_SOURCE_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {canonicalSourceJSON,SOURCE_ACCEPTANCE_SCHEMA,
  SOURCE_ACCEPTANCE_ENVELOPE,SOURCE_ACCEPTANCE_DOMAIN,SOURCE_TRUST_SCHEMA}
  from '../scripts/source_acceptance_gate.mjs';

const NOW=1784419200;
const id='release-readiness-review-v2';
const sha=b=>createHash('sha256').update(b).digest('hex');
const key=()=>{
 const k=generateKeyPairSync('ed25519');
 return {privateKey:k.privateKey,pem:k.publicKey.export({format:'pem',type:'spki'}).toString(),
  fingerprint:sha(k.publicKey.export({format:'der',type:'spki'}))};
};
async function scenario(overrides={},actions={}){
 const registry=await loadFirstPartyPilots();
 const recipe=recipeForPilot(id,registry);
 const original=registry.components.find(x=>x.method_id===id);
 const sourceKey=key(),factKey=key();
 const boundary={
   snapshot_commit:PILOT_RELEASE_V2_SOURCE_COMMIT,
   snapshot_tree:'a'.repeat(40),
   governed_id:id,
   governed_record_sha256:sha(original.packageBytes),
   requested_route:'software-engineering/release-review',
   requested_host_label_not_authority:PILOT_HOST,
   package_inspection_sha256:sha(Buffer.from('INDEPENDENT-C4-FIXTURE-ONLY')),
   package_bytes_verified:true,review_status:'fixture-only',
   review_disposition:'BLOCKED_RIGHTS_AND_HOST'
 };
 const preflight={schema:'qortara/method-to-prism-preflight/1',
   state:'UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION',
   binding:boundary,binding_sha256:sha(canonicalSourceJSON(boundary)),
   source_package_bytes_verified:true,source_byte_verification_not_semantic_review:true,
   independently_authenticated_method_assertion:false,
   operator_accepted_rights:false,host_authority_verified:false,
   composition_eligible:false,prism_invoked:false,prism_guest_decision:null,
   negative_test_vector_hex:'00000000',
   facts_verified:{evidence:false,rights:false,authority:false,coverage:false}
 };
 const operatorTrust={
   schema:SOURCE_TRUST_SCHEMA,issuer:'fixture.external-operator',
   keyId:'fixture-approval',policyRevision:'fixture-v1',
   publicKeyPem:sourceKey.pem,publicKeySha256:sourceKey.fingerprint,
   scope:{snapshotCommit:boundary.snapshot_commit,snapshotTree:boundary.snapshot_tree,
     host:PILOT_HOST,route:boundary.requested_route},
   revocations:{validFrom:NOW-120,expiresAt:NOW+120,revokedApprovalDigests:[]}
 };
 const factTrust={schema:'qortara/method-assertion-trust/1',
   issuer:'fixture.independent-four-facts',keyId:'fixture-facts',policyRevision:'fixture-v1',
   publicKeyPem:factKey.pem,publicKeySha256:factKey.fingerprint,
   revocations:{validFrom:NOW-120,expiresAt:NOW+120,proofDigests:[]}};
 const evidence=Object.fromEntries(['authority','coverage','evidence','rights']
   .map(field=>[field,Buffer.from('SYNTHETIC FICTIONAL '+field+' evidence')]));
 let accepted=0,signedFacts=0,guests=0;
 const readOperatorAcceptance=async ({subjectSha256,bindingSha256})=>{
   accepted++;
   const payload={
     schema:SOURCE_ACCEPTANCE_SCHEMA,issuer:operatorTrust.issuer,
     keyId:operatorTrust.keyId,policyRevision:operatorTrust.policyRevision,
     sourceBindingSha256:bindingSha256,composerSubjectSha256:subjectSha256,
     governedId:boundary.governed_id,snapshotCommit:boundary.snapshot_commit,
     snapshotTree:boundary.snapshot_tree,requestedHost:PILOT_HOST,
     capabilityRoute:boundary.requested_route,
     packageInspectionSha256:boundary.package_inspection_sha256,
     validFrom:NOW-60,expiresAt:NOW+60
   };
   return {schema:SOURCE_ACCEPTANCE_ENVELOPE,payload,
     signature:sign(null,Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+
       canonicalSourceJSON(payload)),sourceKey.privateKey).toString('base64url')};
 };
 const factSigner=createSignedAssertionAdapter({
   trust:factTrust,nowEpoch:()=>NOW,
   loadEnvelope:async subjectSha256=>{
     signedFacts++;
     const flags={authority:true,coverage:true,evidence:true,
       rights:actions.rightsDenied!==true};
     const payload={
       schema:'qortara/method-assertion/1',issuer:factTrust.issuer,
       keyId:factTrust.keyId,policyRevision:factTrust.policyRevision,subjectSha256,
       validFrom:NOW-60,expiresAt:NOW+60,facts:flags,
       evidenceDigests:Object.fromEntries(Object.keys(evidence)
         .map(field=>[field,flags[field]?sha(evidence[field]):null]))
     };
     return {schema:'qortara/signed-method-assertion/1',payload,
       signature:sign(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+
         canonicalJSON(payload)),factKey.privateKey).toString('base64url')};
   },
   readEvidence:async({sha256,field})=>{
     assert.equal(sha(evidence[field]),sha256);
     return evidence[field];
   }
 });
 const root=await mkdtemp(join(tmpdir(),'qortara-bound-source-'));
 const holo=join(root,'fixture-test-only.holo');
 const raw=Buffer.from('NOT A REAL PRISM HOLO - MOCK OUTPUT ONLY');
 await writeFile(holo,raw);
 const input={
   sourceRegistry:registry,recipe,preflight,operatorTrust,
   expectedSourceBindingSha256:preflight.binding_sha256,
   expectedMethodSha256:original.method.sha256,
   expectedSnapshotSha256:registry.sourceSnapshot.sha256,
   readOperatorAcceptance,assertSignedMethod:factSigner,
   holoPath:holo,holoSha256:sha(raw),outputRoot:root,nowEpoch:()=>NOW,
   loadRuntime:async()=>({containers:{run:async(_path,bytes,opts)=>{
     guests++;
     assert.deepEqual(opts,{policy:{minimum:'P0',effects:[]},rm:true});
     const request=Buffer.from(bytes).toString('hex');
     const answer=request==='01010101'?'eligible':'refused: RIGHTS_UNRESOLVED';
     return {status:'exited',exitCode:0,output:new TextEncoder().encode(answer)};
   }}})
 };
 Object.assign(input,overrides);
 return {input,root,recipe,preflight,registry,
   calls:()=>({accepted,signedFacts,guests})};
}
async function run(overrides={},actions={}){
 const fixture=await scenario(overrides,actions);
 try{return await composeOperatorBoundP0(fixture.input);}
 finally{await rm(fixture.root,{recursive:true,force:true});}
}
test('actual original source, two real signature verifiers, mock guest, and sealed disk receipt',async()=>{
 const f=await scenario();
 try{
  const result=await composeOperatorBoundP0(f.input);
  assert.equal(result.state,'STRICT_SIGNED_SOURCE_P0_DEVELOPMENT_CANDIDATE');
  assert.equal(result.methodId,id);
  assert.equal(result.guestInvoked,true);
  assert.deepEqual(f.calls(),{accepted:1,signedFacts:1,guests:1});
  const pkg=await readPackage(result.sealedOutput);
  const receipt=JSON.parse(pkg.files['RECEIPT.json']);
  assert.equal(result.packageManifestSha256,verifyPackage(pkg).packageSha256);
  assert.equal(receipt.sourceApprovalRequired,true);
  assert.equal(receipt.assertions.length,1);
  assert.equal(receipt.assertions[0].sourceAcceptanceProofSha256,result.sourceApprovalProofSha256);
  assert.equal(receipt.assertions[0].proofDigest,result.independentFourFactProofSha256);
  assert.equal(result.legalSourceRightsIndependentlyEstablishedByThisModule,false);
  assert.equal(result.actualHostSkillExecutionObserved,false);
  assert.equal(result.productionEligible,false);
  assert.equal(result.hostValidated,false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('missing independent source, method or snapshot pin refuses before either signer or guest',async()=>{
 for(const key of ['expectedSourceBindingSha256','expectedMethodSha256','expectedSnapshotSha256']){
  const f=await scenario({[key]:undefined});
  try{
   await assert.rejects(composeOperatorBoundP0(f.input),{code:'OPERATOR_PINS'});
   assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
  }finally{await rm(f.root,{recursive:true,force:true});}
 }
});
test('operator method SHA and snapshot SHA substitutions cannot be copied from source',async()=>{
 for(const key of ['expectedSourceBindingSha256','expectedMethodSha256','expectedSnapshotSha256']){
  const f=await scenario({[key]:'f'.repeat(64)});
  try{
   await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_METHOD_MISMATCH'});
   assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
  }finally{await rm(f.root,{recursive:true,force:true});}
 }
});
test('a valid signed approval for another governed method cannot compose this method',async()=>{
 const f=await scenario();
 try{
  f.input.preflight.binding.governed_id='different-original-source';
  f.input.preflight.binding_sha256=sha(canonicalSourceJSON(f.input.preflight.binding));
  f.input.expectedSourceBindingSha256=f.input.preflight.binding_sha256;
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_METHOD_MISMATCH'});
  assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('source snapshot, route and host mismatch must never reach authorization',async()=>{
 for(const altered of ['snapshot_commit','requested_route','requested_host_label_not_authority']){
  const f=await scenario();
  try{
   f.input.preflight.binding[altered]=altered==='snapshot_commit'?'f'.repeat(40):'unexpected';
   f.input.preflight.binding_sha256=sha(canonicalSourceJSON(f.input.preflight.binding));
   f.input.expectedSourceBindingSha256=f.input.preflight.binding_sha256;
   await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_BINDING'});
   assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
  }finally{await rm(f.root,{recursive:true,force:true});}
 }
});
test('source package no longer original or target host changed refuses before signer',async()=>{
 const f=await scenario();
 try{
  f.input.recipe.target_host='different-host';
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'HOST_UNSUPPORTED'});
  assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('signed false rights must reach the real composer guest as refusal, not generate a skill',async()=>{
 const f=await scenario({}, {rightsDenied:true});
 try{
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'PRISM_REFUSED'});
  assert.deepEqual(f.calls(),{accepted:1,signedFacts:1,guests:1});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('a revoked operator approval refuses before the fact adapter and guest',async()=>{
 const f=await scenario();
 try{
  f.input.operatorTrust.revocations.expiresAt=NOW-1;
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_REVOCATIONS'});
  assert.deepEqual(f.calls(),{accepted:1,signedFacts:0,guests:0});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('unsigned source acceptance is not silently replaced by a fixture signer',async()=>{
 const f=await scenario({readOperatorAcceptance:async()=>null});
 try{
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_ACCEPTANCE_MISSING'});
  assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('exclusive destination protects existing signed candidate from replacement',async()=>{
 const f=await scenario();
 try{
  const first=await composeOperatorBoundP0(f.input);
  assert.equal(first.productionEligible,false);
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'EEXIST'});
  assert.deepEqual(await readPackage(first.sealedOutput),
    await readPackage(first.sealedOutput));
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('no user-initiated source-only preflight becomes an approved method',async()=>{
 const f=await scenario();
 try{
  f.input.preflight.source_package_bytes_verified=false;
  await assert.rejects(composeOperatorBoundP0(f.input),{code:'SOURCE_PREFLIGHT'});
  assert.deepEqual(f.calls(),{accepted:0,signedFacts:0,guests:0});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
