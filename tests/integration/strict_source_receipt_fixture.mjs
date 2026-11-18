/**
 * Network-isolated cross-branch integration fixture.
 *
 * PR #37 source signature guard -> PR #28 + receipt extension signer ->
 * mock or exact-pinned real P0 guest -> exclusive development candidate disk seal.
 *
 * All source records, rights, keys and positive facts are SYNTHETIC TEST
 * FIXTURES. The optional real guest proves only P0 execution, never source
 * rights or downstream agent-host behavior.
 */
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFile,rm,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createComposer,verifyPackage,writePackage,readPackage,canonicalJSON} from '../../src/backend/compose.mjs';
import {replaySealedSourceReceipt,replaySealedSourceReceiptFromDisk} from '../../src/backend/source-proof-replay.mjs';
import {createSignedAssertionAdapter} from '../../src/backend/signed-assertions.mjs';
import {createPinnedPrismGuest} from '../../src/backend/prism-guest.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,PILOT_SOURCE_COMMIT,PILOT_HOST} from '../../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../../src/backend/recipe-adapter.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const H='a'.repeat(40),T='b'.repeat(40),MOCK_HOLO='c'.repeat(64),NOW=1784419200;
const PINNED_HOLO='9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e';
const srcText='This is an original, disposable fixture method and not a real host instruction.';
const fixtureMethod=()=>({id:'fixture-review-method',origin:'https://example.invalid/test-only',
 sourcePath:'fixtures/method.txt',commit:H,sha256:SHA(srcText),methodVersion:'v1',
 methodText:srcText,covers:['produce test-only review'],containsAssets:false});
const fixtureRecipe=()=>({schema:'qortara/internal-composition-plan/1',
 name:'fixture-source-proof',title:'Fixture receipt provenance',
 description:'Only tests two independently signed evidence references.',
 targetHost:'fixture-host',requiredOutcomes:['produce test-only review'],
 sourceSnapshot:{repository:'https://example.invalid/source-only',
  commit:H,sha256:'d'.repeat(64)},
 packagePins:[{methodId:'fixture-review-method',packageId:'fixture-package',
  sha256:'e'.repeat(64)}],
 network:false,secrets:false,execution:false});
function key(){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 return {privateKey,pem:publicKey.export({format:'pem',type:'spki'}).toString(),
  sha:SHA(publicKey.export({format:'der',type:'spki'}))};
}
function scope({commit,tree,route,host}){
 return {snapshotCommit:commit,snapshotTree:tree,route,host};
}
const signal=error=>({code:error});
const approvalRefusal=async f=>{
 try{await f();assert.fail('expected a refusal');}
 catch(err){if(err.code==='ERR_ASSERTION')throw err;return err;}
};
async function main(args){
 assert.equal(args[0],'--source-gate-root');
 assert.equal(isAbsolute(args[1]),true);
 const realGuest=args.length===6||args.length===8;
 if(realGuest){
  assert.deepEqual([args[2],args[4]],['--holo','--sha256']);
  assert.ok(isAbsolute(args[3]),'real holo must be absolute');
  assert.equal(args[5],PINNED_HOLO,'only the previously pinned real P0 holo permitted');
 }else assert.equal(args.length,2,'mock mode must not accept extra args');
 const firstParty=args.length===8;
 if(firstParty)assert.deepEqual(args.slice(6),['--pilot','ci-failure-triage']);
 const HOLO=realGuest?PINNED_HOLO:MOCK_HOLO;
 let H='a'.repeat(40),T='b'.repeat(40);
 let route='software-engineering/frontend',host='fixture-host';
 let method=fixtureMethod,recipe=fixtureRecipe;
 let originalMethodSha256=null,sourceGitBlob=null;
 if(firstParty){
  // Exact original source bytes are checked against original Git blob SHA-1
  // and independent SHA-256 pins by loadFirstPartyPilots().
  const registry=await loadFirstPartyPilots();
  const adapted=createRecipeAdapter(registry)(
   recipeForPilot('ci-failure-triage',registry));
  assert.equal(adapted.methods.length,1);
  method=()=>adapted.methods[0];
  recipe=()=>adapted.plan;
  const original=PILOT_DEFINITIONS.find(x=>x.id==='ci-failure-triage');
  assert.equal(method().sha256,original.sha256);
  assert.equal(method().commit,PILOT_SOURCE_COMMIT);
  originalMethodSha256=original.sha256;
  sourceGitBlob=original.gitBlob;
  H=PILOT_SOURCE_COMMIT;
  T='9857c6ef4c4a88b1f4c6c7981be4cc805eab9342';
  route='first-party/unmapped-p0-pilot';
  host=PILOT_HOST;
 }
 const selectedId=method().id;
 const gate=await import(pathToFileURL(join(args[1],
  'scripts/source_acceptance_gate.mjs')).href);
 const {canonicalSourceJSON,SOURCE_ACCEPTANCE_SCHEMA,
  SOURCE_ACCEPTANCE_ENVELOPE,SOURCE_TRUST_SCHEMA,SOURCE_ACCEPTANCE_DOMAIN,
  createSourceBoundAssertionGuard}=gate;
 const b={snapshot_commit:H,snapshot_tree:T,
  governed_id:selectedId,
  governed_record_sha256:firstParty?SHA(method().methodText):'f'.repeat(64),
  requested_route:route,
  requested_host_label_not_authority:host,
  // Test-only binding. Not a C3/Skillz governed rights/license review.
  package_inspection_sha256:firstParty?SHA(canonicalJSON({
   schema:'qortara/first-party-fixture-inventory/1',
   sourceCommit:H,sourceTree:T,
   path:method().sourcePath,methodSha256:originalMethodSha256,
   gitBlob:sourceGitBlob,containsAssets:false
  })):'1'.repeat(64),
  package_bytes_verified:true,
  review_status:firstParty?'not-reviewed':'verified',
  review_disposition:'BLOCKED_RIGHTS_AND_HOST'};
 const sourcePreflight={schema:'qortara/method-to-prism-preflight/1',
  state:'UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION',
  binding:b,binding_sha256:SHA(canonicalSourceJSON(b)),
  source_package_bytes_verified:true,
  source_byte_verification_not_semantic_review:true,
  independently_authenticated_method_assertion:false,operator_accepted_rights:false,
  host_authority_verified:false,composition_eligible:false,
  prism_invoked:false,prism_guest_decision:null,
  negative_test_vector_hex:'00000000',
  facts_verified:{evidence:false,rights:false,authority:false,coverage:false}};
 const sourceKey=key(),factKey=key();
 const sourceTrust={schema:SOURCE_TRUST_SCHEMA,
  issuer:'fixture.source-operator',keyId:'fixture-source-001',
  policyRevision:'fixture-source-policy-001',
  publicKeyPem:sourceKey.pem,publicKeySha256:sourceKey.sha,
  scope:scope({commit:H,tree:T,route,host}),
  revocations:{validFrom:NOW-100,expiresAt:NOW+100,revokedApprovalDigests:[]}};
 const factTrust={schema:'qortara/method-assertion-trust/1',
  issuer:'fixture.four-fact-operator',keyId:'fixture-facts-001',
  policyRevision:'fixture-facts-policy-001',
  publicKeyPem:factKey.pem,publicKeySha256:factKey.sha,
  revocations:{validFrom:NOW-100,expiresAt:NOW+100,proofDigests:[]}};
 const evidence={};
 for(const field of ['authority','coverage','evidence','rights'])
  evidence[field]=Buffer.from('fixture-only signed '+field+' fact');
 let proofSource,proofFacts,guestCalls=0,factCalls=0;
 const assertSignedMethod=createSignedAssertionAdapter({
  trust:factTrust,nowEpoch:()=>NOW,
  loadEnvelope:async subjectSha256=>{
   factCalls++;
   const payload={schema:'qortara/method-assertion/1',
    subjectSha256,issuer:factTrust.issuer,keyId:factTrust.keyId,
    policyRevision:factTrust.policyRevision,
    validFrom:NOW-40,expiresAt:NOW+40,
    facts:{authority:true,coverage:true,evidence:true,rights:true},
    evidenceDigests:Object.fromEntries(Object.entries(evidence)
      .map(([field,bytes])=>[field,SHA(bytes)]))};
   const signed={schema:'qortara/signed-method-assertion/1',payload,
    signature:sign(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+
     canonicalJSON(payload)),factKey.privateKey).toString('base64url')};
   proofFacts=SHA(canonicalJSON(signed));
   return signed;
  },
  readEvidence:async({sha256,field})=>{
   assert.equal(SHA(evidence[field]),sha256);
   return evidence[field];
  }
 });
 const readApproval=async({subjectSha256,bindingSha256})=>{
  const payload={schema:SOURCE_ACCEPTANCE_SCHEMA,
   issuer:sourceTrust.issuer,keyId:sourceTrust.keyId,
   policyRevision:sourceTrust.policyRevision,
   sourceBindingSha256:bindingSha256,composerSubjectSha256:subjectSha256,
   governedId:b.governed_id,snapshotCommit:b.snapshot_commit,snapshotTree:b.snapshot_tree,
   requestedHost:b.requested_host_label_not_authority,capabilityRoute:b.requested_route,
   packageInspectionSha256:b.package_inspection_sha256,
   validFrom:NOW-40,expiresAt:NOW+40};
  const signed={schema:SOURCE_ACCEPTANCE_ENVELOPE,payload,
   signature:sign(null,Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+
    canonicalSourceJSON(payload)),sourceKey.privateKey).toString('base64url')};
  proofSource=SHA(canonicalSourceJSON(signed));
  return signed;
 };
 const assertMethod=createSourceBoundAssertionGuard({
  preflight:sourcePreflight,trust:sourceTrust,
  readOperatorAcceptance:readApproval,
  assertSignedMethod,nowEpoch:()=>NOW
 });
 const actualGuest=realGuest?createPinnedPrismGuest({
  holoPath:args[3],holoSha256:PINNED_HOLO,
  developmentP0Consent:true
 }):null;
 const guest=async({requestHex,holoSha256})=>{
  guestCalls++;
  assert.ok(['01010101','01000101'].includes(requestHex),'expected four facts');
  assert.equal(holoSha256,HOLO);
  if(realGuest)return actualGuest({requestHex,holoSha256});
  const response=requestHex==='01000101'?'refused: RIGHTS_UNRESOLVED':'eligible';
  return {schema:'qortara/local-eligibility-result/1',
   status:'GUEST_COMPLETED',application:'Qortara Skills Eligibility',
   requestHex,response,responseHex:Buffer.from(response).toString('hex'),
   engine:'prism-code@0.9.5',artifact:{sha256:holoSha256},
   productionEligible:false,exitCode:0};
 };
 const compose=createComposer({
  assertMethod,runPrism:guest,holoSha256:HOLO,
  sourceApprovalBindings:{[selectedId]:sourcePreflight.binding_sha256}
 });
 const pkg=await compose(recipe(),[method()]);
 assert.equal(guestCalls,1);assert.equal(factCalls,1);
 const receipt=JSON.parse(pkg.files['RECEIPT.json']);
 assert.equal(receipt.sourceApprovalRequired,true);
 assert.equal(receipt.assertions[0].sourceBindingSha256,sourcePreflight.binding_sha256);
 assert.equal(receipt.assertions[0].sourceAcceptanceProofSha256,proofSource);
 assert.equal(receipt.assertions[0].proofDigest,proofFacts);
 assert.equal(receipt.productionEligible,false);
 const verification=verifyPackage(pkg);
 assert.equal(verification.sourceAcceptanceProofRecorded,true);
 assert.equal(verification.sourceAcceptanceSignatureVerified,false);
 assert.equal(verification.signedFourFactAssertionReverified,false);
 const replayConfiguration={
  expectedSourceBindings:{[selectedId]:sourcePreflight.binding_sha256},
  expectedHoloSha256:HOLO,
  verifySourceAcceptance:async({subjectSha256,sourceBindingSha256,
                                approvalProofSha256})=>{
   const approval=await readApproval({subjectSha256,bindingSha256:sourceBindingSha256});
   const verified=gate.verifySourceAcceptance({
    preflight:sourcePreflight,trust:sourceTrust,
    envelope:approval,subjectSha256,nowEpoch:()=>NOW});
   assert.equal(verified.acceptanceProofSha256,approvalProofSha256);
   return verified;
  },
  verifySignedMethod:async({subjectSha256})=>assertSignedMethod({subjectSha256}),
  runPrism:guest
 };
 const replay=await replaySealedSourceReceipt(pkg,replayConfiguration);
 assert.equal(replay.state,'P0_DEVELOPMENT_RECEIPT_REPLAYED_BY_CONFIGURED_ADAPTERS');
 assert.equal(replay.receiptMethodCount,1);
 assert.equal(replay.methods[0].sourceApprovalProofSha256,proofSource);
 assert.equal(replay.methods[0].signedFourFactProofSha256,proofFacts);
 assert.equal(replay.productionEligible,false);
 assert.equal(guestCalls,2);
 assert.equal(factCalls,2);
 const root=await mkdtemp(join(tmpdir(),'qortara-strict-fixture-'));
 try{
  const dest=join(root,'sealed-development-candidate');
  await writePackage(pkg,dest);
  assert.deepEqual(await readPackage(dest),pkg);
  const diskReplay=await replaySealedSourceReceiptFromDisk(dest,replayConfiguration);
  assert.equal(diskReplay.diskCompletionSealVerified,true);
  assert.equal(diskReplay.verifiedDiskManifestSha256,
   SHA(pkg.files['skill-mason.json']));
  assert.equal(diskReplay.methods[0].sourceApprovalProofSha256,proofSource);
  assert.equal(diskReplay.productionEligible,false);
  assert.equal(guestCalls,3);assert.equal(factCalls,3);
  const changed=JSON.parse(await readFile(join(dest,'RECEIPT.json'),'utf8'));
  changed.assertions[0].sourceBindingSha256='9'.repeat(64);
  await writeFile(join(dest,'RECEIPT.json'),JSON.stringify(changed)+'\n');
  await assert.rejects(readPackage(dest),signal('PACKAGE_INTEGRITY'));
  await assert.rejects(replaySealedSourceReceiptFromDisk(dest,replayConfiguration),
   signal('PACKAGE_INTEGRITY'));
  // A corrupted disk candidate must never reach even the source signer.
  assert.equal(guestCalls,3);assert.equal(factCalls,3);
 }finally{await rm(root,{recursive:true,force:true});}
 let deniedGuest=0,deniedFacts=0;
 const noApproval=createSourceBoundAssertionGuard({
  preflight:sourcePreflight,trust:sourceTrust,
  readOperatorAcceptance:async()=>null,
  assertSignedMethod:async()=>{deniedFacts++;return {};},
  nowEpoch:()=>NOW
 });
 const refused=createComposer({
  assertMethod:noApproval,runPrism:()=>{deniedGuest++;},
  holoSha256:HOLO,
  sourceApprovalBindings:{[selectedId]:sourcePreflight.binding_sha256}
 });
 const denial=await approvalRefusal(()=>refused(recipe(),[method()]));
 assert.equal(denial.code,'SOURCE_ACCEPTANCE_MISSING');
 assert.equal(deniedFacts,0);assert.equal(deniedGuest,0);
 // Unlike the missing-source refusal above, this has a valid fixture source
 // approval and a separately signed, explicitly negative rights fact. The
 // real Prism guest must decide the denial. No package may be emitted.
 const signedRightsDenial=createSignedAssertionAdapter({
  trust:factTrust,nowEpoch:()=>NOW,
  loadEnvelope:async subjectSha256=>{
   const payload={schema:'qortara/method-assertion/1',
    subjectSha256,issuer:factTrust.issuer,keyId:factTrust.keyId,
    policyRevision:factTrust.policyRevision,
    validFrom:NOW-40,expiresAt:NOW+40,
    facts:{authority:true,coverage:true,evidence:true,rights:false},
    evidenceDigests:Object.fromEntries(Object.entries(evidence)
      .map(([field,bytes])=>[field,field==='rights'?null:SHA(bytes)]))};
   return {schema:'qortara/signed-method-assertion/1',payload,
    signature:sign(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+
     canonicalJSON(payload)),factKey.privateKey).toString('base64url')};
  },
  readEvidence:async({sha256,field})=>{
   assert.notEqual(field,'rights','false rights cannot resolve positive evidence');
   assert.equal(SHA(evidence[field]),sha256);
   return evidence[field];
  }
 });
 const rightsDenialGuard=createSourceBoundAssertionGuard({
  preflight:sourcePreflight,trust:sourceTrust,
  readOperatorAcceptance:readApproval,
  assertSignedMethod:signedRightsDenial,nowEpoch:()=>NOW
 });
 const rightsDenialComposer=createComposer({
  assertMethod:rightsDenialGuard,runPrism:guest,holoSha256:HOLO,
  sourceApprovalBindings:{[selectedId]:sourcePreflight.binding_sha256}
 });
 const deniedByGuest=await approvalRefusal(()=>
  rightsDenialComposer(recipe(),[method()]));
 assert.equal(deniedByGuest.code,'PRISM_REFUSED');
 assert.match(deniedByGuest.message,/RIGHTS_UNRESOLVED/);
 assert.equal(guestCalls,4,'signed rights denial reached guest after three accepts');
 const output={
  schema:'qortara/strict-source-receipt-fixture-integration/1',
  state:'FIXTURE_ONLY_TWO_SIGNATURES_AND_SEALED_DIGESTS',
  sourceBindingSha256:sourcePreflight.binding_sha256,
  sourceAcceptanceProofSha256:proofSource,
  signedFourFactProofSha256:proofFacts,
  methodSubjectSha256:receipt.assertions[0].subjectSha256,
  selectedMethodId:selectedId,
  firstPartyOriginalMethodSourceUsed:firstParty,
  firstPartyOriginalMethodSha256:originalMethodSha256,
  firstPartyExactGitBlob:sourceGitBlob,
  originalFirstPartySourceBytesIndependentlyPinned:firstParty,
  skillzC4GovernedReviewOrRightsQualified:false,
  exactPinnedSourceGateImported:true,
  sourceApprovalRequiredByComposer:true,
  bothProofDigestsSealed:true,
  sourceApprovalSignatureReplayedByActualGate:true,
  independentlySignedFourFactProofReplayedByActualAdapter:true,
  pinnedGuestReplayedUsingFixtureMock:!realGuest,
  realPinnedPrismGuestExecuted:realGuest,
  pinnedP0HoloSha256:HOLO,
  realGuestCalls:realGuest?guestCalls:0,
  signedRightsDenialReachedGuest:true,
  signedRightsDenialRefused:true,
  exclusiveDiskSealVerified:true,
  independentDiskSealedReplayWithRealSignatureVerifiers:true,
  tamperedDiskReceiptRefused:true,
  tamperedDiskReplayRefusedBeforeVerifiers:true,
  missingSourceApprovalStoppedBeforeGuest:true,
  positiveFactsAreFixturesOnly:true,
  prismGuestIsMock:!realGuest,
  productionEligible:false,hostValidated:false,sourceRightsEstablished:false
 };
 console.log(JSON.stringify(output));
}
main(process.argv.slice(2)).catch(err=>{
 console.error(JSON.stringify({state:'REFUSED',code:err.code??'STRICT_FIXTURE_FAILURE',
  message:String(err.message??err),productionEligible:false}));
 process.exitCode=1;
});
