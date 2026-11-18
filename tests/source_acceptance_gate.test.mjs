import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {
 SOURCE_ACCEPTANCE_SCHEMA,SOURCE_ACCEPTANCE_ENVELOPE,
 SOURCE_TRUST_SCHEMA,SOURCE_ACCEPTANCE_DOMAIN,
 canonicalSourceJSON,validateSourcePreflight,verifySourceAcceptance,
 createSourceBoundAssertionGuard
} from '../scripts/source_acceptance_gate.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const NOW=1784419200;
const SUBJECT='c'.repeat(64);
const COMMIT='a'.repeat(40),TREE='b'.repeat(40);
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({format:'pem',type:'spki'}).toString();
const fingerprint=sha(publicKey.export({format:'der',type:'spki'}));

function preflight(){
 const binding={
  snapshot_commit:COMMIT,snapshot_tree:TREE,
  governed_id:'anthropic-skills/frontend-design',
  governed_record_sha256:'d'.repeat(64),
  requested_route:'software-engineering/frontend',
  requested_host_label_not_authority:'ChatGPT',
  package_inspection_sha256:'e'.repeat(64),
  package_bytes_verified:true,review_status:'verified',
  review_disposition:'BLOCKED_RIGHTS_AND_HOST'
 };
 return {
  schema:'qortara/method-to-prism-preflight/1',
  state:'UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION',
  binding,binding_sha256:sha(canonicalSourceJSON(binding)),
  negative_test_vector_hex:'00000000',
  source_package_bytes_verified:true,
  source_byte_verification_not_semantic_review:true,
  independently_authenticated_method_assertion:false,
  operator_accepted_rights:false,host_authority_verified:false,
  composition_eligible:false,prism_invoked:false,prism_guest_decision:null,
  facts_verified:{evidence:false,rights:false,authority:false,coverage:false}
 };
}
function trust(){
 return {
  schema:SOURCE_TRUST_SCHEMA,issuer:'operator.test',keyId:'source-binding-key',
  policyRevision:'test-only-v1',publicKeyPem:pem,
  publicKeySha256:fingerprint,
  scope:{snapshotCommit:COMMIT,snapshotTree:TREE,
         route:'software-engineering/frontend',host:'ChatGPT'},
  revocations:{validFrom:NOW-100,expiresAt:NOW+100,revokedApprovalDigests:[]}
 };
}
function approved(p=preflight(),subject=SUBJECT){
 const b=p.binding;
 return {
  schema:SOURCE_ACCEPTANCE_SCHEMA,
  issuer:'operator.test',keyId:'source-binding-key',
  policyRevision:'test-only-v1',
  sourceBindingSha256:p.binding_sha256,composerSubjectSha256:subject,
  governedId:b.governed_id,snapshotCommit:b.snapshot_commit,
  snapshotTree:b.snapshot_tree,requestedHost:b.requested_host_label_not_authority,
  capabilityRoute:b.requested_route,
  packageInspectionSha256:b.package_inspection_sha256,
  validFrom:NOW-50,expiresAt:NOW+50
 };
}
function signed(payload=approved(),key=privateKey){
 return {
  schema:SOURCE_ACCEPTANCE_ENVELOPE,payload,
  signature:sign(null,Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+
    canonicalSourceJSON(payload)),key).toString('base64url')
 };
}
function inputs(){
 return {preflight:preflight(),trust:trust(),envelope:signed(),
         subjectSha256:SUBJECT,nowEpoch:()=>NOW};
}
const refusal=code=>({code});

test('independent ephemeral signature binds exact source, host and composer subject but grants zero four facts',()=>{
 const v=verifySourceAcceptance(inputs());
 assert.equal(v.state,'OPERATOR_SOURCE_BINDING_SIGNATURE_VALID');
 assert.equal(v.sourceBindingSha256,inputs().preflight.binding_sha256);
 assert.equal(v.composerSubjectSha256,SUBJECT);
 assert.equal(v.operatorIssuer,'operator.test');
 assert.match(v.acceptanceProofSha256,/^[0-9a-f]{64}$/);
 assert.equal(v.signatureAuthenticatesOnlyIssuerClaim,true);
 assert.equal(v.legalRightsIndependentlyEstablishedByThisVerifier,false);
 assert.equal(v.prismFourFactsVerified,false);
 assert.equal(v.compositionEligible,false);
 assert.equal(v.prismInvoked,false);
});
test('default missing operator acceptance and trust fail closed',()=>{
 const x=inputs();delete x.trust;delete x.envelope;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_ACCEPTANCE_MISSING'));
});
test('unreviewed source bytes cannot be signed into completeness',()=>{
 const x=inputs();x.preflight.source_package_bytes_verified=false;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_PREFLIGHT'));
});
test('positive fact inside source preflight is refused even with valid independent signature',()=>{
 const x=inputs();x.preflight.facts_verified.rights=true;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_PREFLIGHT'));
});
test('unsigned source source digest tampering refuses',()=>{
 const x=inputs();x.preflight.binding.governed_record_sha256='f'.repeat(64);
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_BINDING'));
});
test('license and package ledger pin drift without approval re-signing refuses',()=>{
 const x=inputs();x.preflight.binding.package_inspection_sha256='f'.repeat(64);
 x.preflight.binding_sha256=sha(canonicalSourceJSON(x.preflight.binding));
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL_SCOPE'));
});
test('source snapshot upgrade cannot reuse old acceptance',()=>{
 const x=inputs();x.preflight.binding.snapshot_commit='f'.repeat(40);
 x.preflight.binding_sha256=sha(canonicalSourceJSON(x.preflight.binding));
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_BINDING'));
});
test('same reviewed source from a different host cannot borrow operator approval',()=>{
 const x=inputs();x.preflight.binding.requested_host_label_not_authority='Claude';
 x.preflight.binding_sha256=sha(canonicalSourceJSON(x.preflight.binding));
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_BINDING'));
});
test('exact same package selected for different route cannot borrow signed scope',()=>{
 const x=inputs();x.preflight.binding.requested_route='business/marketing';
 x.preflight.binding_sha256=sha(canonicalSourceJSON(x.preflight.binding));
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_BINDING'));
});
test('different Prism plan/method subject cannot borrow matching source approval',()=>{
 const x=inputs();x.subjectSha256='f'.repeat(64);
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL_SCOPE'));
});
test('wrong signing key fails cryptographic verification',()=>{
 const x=inputs(),other=generateKeyPairSync('ed25519');
 x.envelope=signed(approved(),other.privateKey);
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_SIGNATURE'));
});
test('modified signed host fails signature validation',()=>{
 const x=inputs();x.envelope.payload.requestedHost='Claude';
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL_SCOPE'));
});
test('altered signed validity interval without re-signing fails',()=>{
 const x=inputs();x.envelope.payload.expiresAt+=1;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_SIGNATURE'));
});
test('expired operator decision is refused',()=>{
 const x=inputs();x.nowEpoch=()=>NOW+60;x.trust.revocations.expiresAt=NOW+300;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL_EXPIRED'));
});
test('stale revocations cannot be bypassed by valid signature',()=>{
 const x=inputs();x.trust.revocations.expiresAt=NOW-1;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_REVOCATIONS'));
});
test('revoked exact signed operator decision refuses',()=>{
 const x=inputs();x.trust.revocations.revokedApprovalDigests=[
  sha(canonicalSourceJSON(x.envelope))];
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL_REVOKED'));
});
test('untrusted key fingerprint substitution fails closed',()=>{
 const x=inputs();x.trust.publicKeySha256='f'.repeat(64);
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_TRUST'));
});
test('unknown signed field or policy promotion refuses',()=>{
 const x=inputs();x.envelope.payload.compositionEligible=true;
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_APPROVAL'));
});
test('unnamed subject or insufficient signature rejects',()=>{
 const x=inputs();x.subjectSha256='';
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_SUBJECT'));
 x.subjectSha256=SUBJECT;x.envelope.signature='this-is-not-ed25519';
 assert.throws(()=>verifySourceAcceptance(x),refusal('SOURCE_SIGNATURE'));
});
test('operator trust cannot come from preflight config nor caller payload',()=>{
 const x=inputs();x.preflight.operator_accepted_rights=true;
 assert.throws(()=>validateSourcePreflight(x.preflight,x.trust.scope),
               refusal('SOURCE_PREFLIGHT'));
});
test('trusted coordinator guard refuses before calling four-fact adapter when approval absent',async()=>{
 let calls=0;const x=inputs();
 const gated=createSourceBoundAssertionGuard({
  preflight:x.preflight,trust:x.trust,nowEpoch:x.nowEpoch,
  readOperatorAcceptance:async()=>{throw Object.assign(new Error('No signer'),{
   code:'SOURCE_ACCEPTANCE_MISSING'});},
  assertSignedMethod:async()=>{calls++;return {}; }
 });
 await assert.rejects(gated({subjectSha256:SUBJECT}),refusal('SOURCE_ACCEPTANCE_MISSING'));
 assert.equal(calls,0);
});
test('trusted source signature and independent signed-fact delegate are both required',async()=>{
 let calls=0;const x=inputs();const receipt=signed();
 const gated=createSourceBoundAssertionGuard({
  preflight:x.preflight,trust:x.trust,nowEpoch:x.nowEpoch,
  readOperatorAcceptance:async()=>receipt,
  assertSignedMethod:async({subjectSha256})=>{
   calls++;return {subjectSha256,issuer:'fixture.signed-facts',
    proofDigest:'f'.repeat(64),evidence:true,rights:false,
    authority:false,coverage:false};
  }
 });
 const result=await gated({subjectSha256:SUBJECT});
 assert.equal(calls,1);
 assert.equal(result.sourceAcceptanceProofSha256,sha(canonicalSourceJSON(receipt)));
 assert.equal(result.sourceBindingSha256,x.preflight.binding_sha256);
 assert.equal(result.rights,false);
 assert.equal(result.authority,false);
});
test('mutation after trusted gate construction cannot change pinned scope',async()=>{
 const x=inputs();const p=x.preflight,t=x.trust;let calls=0;
 const gated=createSourceBoundAssertionGuard({
  preflight:p,trust:t,nowEpoch:x.nowEpoch,
  readOperatorAcceptance:async()=>signed(),
  assertSignedMethod:async({subjectSha256})=>{
   calls++;return {subjectSha256,issuer:'fixture',proofDigest:'f'.repeat(64),
    evidence:false,rights:false,authority:false,coverage:false};
  }
 });
 p.binding.governed_record_sha256='f'.repeat(64);
 t.publicKeySha256='0'.repeat(64);
 const v=await gated({subjectSha256:SUBJECT});
 assert.equal(v.sourceAcceptanceProofSha256,sha(canonicalSourceJSON(signed())));
 assert.equal(v.sourceBindingSha256,x.preflight.binding_sha256);
 assert.equal(calls,1);
});
test('untrusted assertion delegate malformed subject cannot bypass composer',async()=>{
 const x=inputs();
 const gated=createSourceBoundAssertionGuard({
  preflight:x.preflight,trust:x.trust,nowEpoch:x.nowEpoch,
  readOperatorAcceptance:async()=>signed(),
  assertSignedMethod:async()=>({subjectSha256:'0'.repeat(64),proofDigest:'f'.repeat(64),
   issuer:'fixture',evidence:true,rights:true,authority:true,coverage:true})
 });
 await assert.rejects(gated({subjectSha256:SUBJECT}),refusal('SOURCE_FACT_ASSERTION'));
});
