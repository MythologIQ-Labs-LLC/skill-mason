/**
 * Network-isolated cross-branch integration fixture.
 *
 * PR #37 source signature guard -> PR #28 + receipt extension signer ->
 * mock P0 guest -> exclusive development candidate disk seal.
 *
 * All source records, rights, keys and positive facts are SYNTHETIC TEST
 * FIXTURES. Do not present this as a real skillz source, host, or rights test.
 */
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFile,rm,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createComposer,verifyPackage,writePackage,readPackage,canonicalJSON} from '../../src/backend/compose.mjs';
import {replaySealedSourceReceipt} from '../../src/backend/source-proof-replay.mjs';
import {createSignedAssertionAdapter} from '../../src/backend/signed-assertions.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const H='a'.repeat(40),T='b'.repeat(40),HOLO='c'.repeat(64),NOW=1784419200;
const srcText='This is an original, disposable fixture method and not a real host instruction.';
const method=()=>({id:'fixture-review-method',origin:'https://example.invalid/test-only',
 sourcePath:'fixtures/method.txt',commit:H,sha256:SHA(srcText),methodVersion:'v1',
 methodText:srcText,covers:['produce test-only review'],containsAssets:false});
const recipe=()=>({schema:'qortara/internal-composition-plan/1',
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
function scope(){
 return {snapshotCommit:H,snapshotTree:T,
  route:'software-engineering/frontend',host:'fixture-host'};
}
const signal=error=>({code:error});
const approvalRefusal=async f=>{
 try{await f();assert.fail('expected a refusal');}
 catch(err){if(err.code==='ERR_ASSERTION')throw err;return err;}
};
async function main(args){
 assert.deepEqual(args.slice(0,1),['--source-gate-root']);
 assert.equal(args.length,2);
 assert.equal(isAbsolute(args[1]),true);
 const gate=await import(pathToFileURL(join(args[1],
  'scripts/source_acceptance_gate.mjs')).href);
 const {canonicalSourceJSON,SOURCE_ACCEPTANCE_SCHEMA,
  SOURCE_ACCEPTANCE_ENVELOPE,SOURCE_TRUST_SCHEMA,SOURCE_ACCEPTANCE_DOMAIN,
  createSourceBoundAssertionGuard}=gate;
 const b={snapshot_commit:H,snapshot_tree:T,
  governed_id:'fixture-review-method',governed_record_sha256:'f'.repeat(64),
  requested_route:'software-engineering/frontend',
  requested_host_label_not_authority:'fixture-host',
  package_inspection_sha256:'1'.repeat(64),package_bytes_verified:true,
  review_status:'verified',review_disposition:'BLOCKED_RIGHTS_AND_HOST'};
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
  scope:scope(),
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
 const guest=({requestHex,holoSha256})=>{
  guestCalls++;assert.equal(requestHex,'01010101');
  assert.equal(holoSha256,HOLO);
  return {schema:'qortara/local-eligibility-result/1',
   status:'GUEST_COMPLETED',application:'Qortara Skills Eligibility',
   requestHex,response:'eligible',responseHex:'656c696769626c65',
   engine:'prism-code@0.9.5',artifact:{sha256:holoSha256},
   productionEligible:false,exitCode:0};
 };
 const compose=createComposer({
  assertMethod,runPrism:guest,holoSha256:HOLO,
  sourceApprovalBindings:{'fixture-review-method':sourcePreflight.binding_sha256}
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
 const replay=await replaySealedSourceReceipt(pkg,{
  expectedSourceBindings:{'fixture-review-method':sourcePreflight.binding_sha256},
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
 });
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
  const changed=JSON.parse(await readFile(join(dest,'RECEIPT.json'),'utf8'));
  changed.assertions[0].sourceBindingSha256='9'.repeat(64);
  await writeFile(join(dest,'RECEIPT.json'),JSON.stringify(changed)+'\n');
  await assert.rejects(readPackage(dest),signal('PACKAGE_INTEGRITY'));
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
  sourceApprovalBindings:{'fixture-review-method':sourcePreflight.binding_sha256}
 });
 const denial=await approvalRefusal(()=>refused(recipe(),[method()]));
 assert.equal(denial.code,'SOURCE_ACCEPTANCE_MISSING');
 assert.equal(deniedFacts,0);assert.equal(deniedGuest,0);
 const output={
  schema:'qortara/strict-source-receipt-fixture-integration/1',
  state:'FIXTURE_ONLY_TWO_SIGNATURES_AND_SEALED_DIGESTS',
  sourceBindingSha256:sourcePreflight.binding_sha256,
  sourceAcceptanceProofSha256:proofSource,
  signedFourFactProofSha256:proofFacts,
  methodSubjectSha256:receipt.assertions[0].subjectSha256,
  exactPinnedSourceGateImported:true,
  sourceApprovalRequiredByComposer:true,
  bothProofDigestsSealed:true,
  sourceApprovalSignatureReplayedByActualGate:true,
  independentlySignedFourFactProofReplayedByActualAdapter:true,
  pinnedGuestReplayedUsingFixtureMock:true,
  exclusiveDiskSealVerified:true,
  tamperedDiskReceiptRefused:true,
  missingSourceApprovalStoppedBeforeGuest:true,
  positiveFactsAreFixturesOnly:true,
  prismGuestIsMock:true,
  productionEligible:false,hostValidated:false,sourceRightsEstablished:false
 };
 console.log(JSON.stringify(output));
}
main(process.argv.slice(2)).catch(err=>{
 console.error(JSON.stringify({state:'REFUSED',code:err.code??'STRICT_FIXTURE_FAILURE',
  message:String(err.message??err),productionEligible:false}));
 process.exitCode=1;
});
