#!/usr/bin/env node
/**
 * Interop-only: exact live pinned Skillz C4 source receipt -> source-binding
 * signer (ephemeral test-only) -> actual PR #28 signed four-fact adapter
 * (another ephemeral test-only signer). No Prism guest or skill composition.
 */
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  canonicalSourceJSON,verifySourceAcceptance,createSourceBoundAssertionGuard,
  SOURCE_ACCEPTANCE_DOMAIN,SOURCE_ACCEPTANCE_SCHEMA,
  SOURCE_ACCEPTANCE_ENVELOPE,SOURCE_TRUST_SCHEMA
} from '../../scripts/source_acceptance_gate.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const CLOCK=1784419200;
function keypair(){
 const k=generateKeyPairSync('ed25519');
 return {privateKey:k.privateKey,pem:k.publicKey.export({type:'spki',format:'pem'}).toString(),
   sha256:sha(k.publicKey.export({type:'spki',format:'der'}))};
}
const deny=async fn=>{
 try{await fn();assert.fail('expected refusal');}
 catch(err){if(err.code==='ERR_ASSERTION')throw err;return err;}
};
async function main(args){
 if(args.length!==4||args[0]!=='--preflight'||args[2]!=='--p0-root'||
    !isAbsolute(args[1])||!isAbsolute(args[3]))
   throw new Error('Usage: --preflight ABSOLUTE_JSON --p0-root ABSOLUTE_CHECKOUT');
 const source=JSON.parse(await readFile(args[1],'utf8'));
 const {createSignedAssertionAdapter}=await import(pathToFileURL(
   join(args[3],'src/backend/signed-assertions.mjs')).href);
 const {canonicalJSON}=await import(pathToFileURL(
   join(args[3],'src/backend/compose.mjs')).href);
 // A deliberately constructed test-only subject. This is NOT an actual
 // composed source method and never asserts its behavioral suitability.
 const subjectSha256=sha(Buffer.from(canonicalJSON({
   schema:'qortara/test-subject-only/1',
   sourceBindingSha256:source.binding_sha256,
   fixture:'signed-adapter-interoperability-not-a-method'})));
 const b=source.binding;
 const sourceSigner=keypair(),factSigner=keypair();
 const approvalTrust={
   schema:SOURCE_TRUST_SCHEMA,issuer:'fixture.source-review',
   keyId:'fixture-source-key',policyRevision:'fixture-policy-v1',
   publicKeyPem:sourceSigner.pem,publicKeySha256:sourceSigner.sha256,
   scope:{snapshotCommit:b.snapshot_commit,snapshotTree:b.snapshot_tree,
          route:b.requested_route,host:b.requested_host_label_not_authority},
   revocations:{validFrom:CLOCK-3600,expiresAt:CLOCK+3600,
                revokedApprovalDigests:[]}
 };
 const approvalPayload={
   schema:SOURCE_ACCEPTANCE_SCHEMA,issuer:approvalTrust.issuer,
   keyId:approvalTrust.keyId,policyRevision:approvalTrust.policyRevision,
   sourceBindingSha256:source.binding_sha256,composerSubjectSha256:subjectSha256,
   governedId:b.governed_id,snapshotCommit:b.snapshot_commit,
   snapshotTree:b.snapshot_tree,requestedHost:b.requested_host_label_not_authority,
   capabilityRoute:b.requested_route,packageInspectionSha256:b.package_inspection_sha256,
   validFrom:CLOCK-60,expiresAt:CLOCK+60
 };
 const approvalEnvelope={
   schema:SOURCE_ACCEPTANCE_ENVELOPE,payload:approvalPayload,
   signature:sign(null,Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+
     canonicalSourceJSON(approvalPayload)),sourceSigner.privateKey).toString('base64url')
 };
 const accepted=verifySourceAcceptance({
   preflight:source,trust:approvalTrust,envelope:approvalEnvelope,
   subjectSha256,nowEpoch:()=>CLOCK});
 assert.equal(accepted.state,'OPERATOR_SOURCE_BINDING_SIGNATURE_VALID');
 assert.equal(accepted.compositionEligible,false);
 assert.equal(accepted.prismFourFactsVerified,false);
 const factTrust={
   schema:'qortara/method-assertion-trust/1',
   issuer:'fixture.four-fact-review',keyId:'fixture-fact-key',
   publicKeyPem:factSigner.pem,publicKeySha256:factSigner.sha256,
   policyRevision:'fixture-policy-v1',
   revocations:{validFrom:CLOCK-3600,expiresAt:CLOCK+3600,proofDigests:[]}
 };
 let factCalls=0;
 const signedFacts=createSignedAssertionAdapter({
   trust:factTrust,
   loadEnvelope:async subject=>{
     const payload={
       schema:'qortara/method-assertion/1',
       issuer:factTrust.issuer,keyId:factTrust.keyId,
       policyRevision:factTrust.policyRevision,subjectSha256:subject,
       validFrom:CLOCK-60,expiresAt:CLOCK+60,
       facts:{evidence:false,rights:false,authority:false,coverage:false},
       evidenceDigests:{evidence:null,rights:null,authority:null,coverage:null}
     };
     return {schema:'qortara/signed-method-assertion/1',payload,
       signature:sign(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+
        canonicalJSON(payload)),factSigner.privateKey).toString('base64url')};
   },
   readEvidence:async()=>{throw new Error('No positive fact may read evidence');},
   nowEpoch:()=>CLOCK
 });
 const guarded=(target,approval)=>createSourceBoundAssertionGuard({
   preflight:target,trust:approvalTrust,nowEpoch:()=>CLOCK,
   readOperatorAcceptance:async()=>approval,
   assertSignedMethod:async input=>{factCalls++;return signedFacts(input);}
 });
 const result=await guarded(source,approvalEnvelope)({subjectSha256});
 assert.equal(factCalls,1);
 assert.equal(result.sourceAcceptanceProofSha256,
   accepted.acceptanceProofSha256);
 assert.deepEqual([result.evidence,result.rights,result.authority,result.coverage],
   [false,false,false,false]);
 assert.equal(result.subjectSha256,subjectSha256);
 // Deliberately no Prism run. A signed FALSE is a refusal, not admission.
 const denied=await deny(async()=>guarded(source,null)({subjectSha256}));
 assert.equal(denied.code,'SOURCE_ACCEPTANCE_MISSING');
 assert.equal(factCalls,1,'missing source approval must refuse BEFORE signed-fact adapter');
 const modified=JSON.parse(JSON.stringify(source));
 modified.binding.package_inspection_sha256='0'.repeat(64);
 modified.binding_sha256=sha(canonicalSourceJSON(modified.binding));
 const swapped=await deny(async()=>guarded(modified,approvalEnvelope)({subjectSha256}));
 assert.equal(swapped.code,'SOURCE_APPROVAL_SCOPE');
 assert.equal(factCalls,1,'asset-rights ledger drift must stop before four-fact verification');
 const report={
   schema:'qortara/external-source-to-p0-signed-assertion-interop/1',
   source:'real-pinned-original-external-package',testSignatures:'EPHEMERAL_FIXTURE_ONLY',
   sourceRecord:b.governed_id,sourceBindingSha256:source.binding_sha256,
   sourceAcceptanceProofSha256:accepted.acceptanceProofSha256,
   signedFourFactProofSha256:result.proofDigest,
   fixtureOnlyP0SubjectSha256:subjectSha256,
   actualP0AdapterSource:'exact-pinned-PR28',operatorSignatureChecked:true,
   independentlySignedFourFactsChecked:true,
   falseFacts:[result.evidence,result.rights,result.authority,result.coverage],
   absentApprovalStoppedBeforeFactAdapter:true,
   changedAssetReviewStoppedBeforeFactAdapter:true,
   verifiedSourceRights:false,hostQualified:false,
   realGuestInvoked:false,methodComposed:false,productionEligible:false,
   status:'CRYPTOGRAPHIC_INTEROP_PASSED_NOT_METHOD_ACCEPTANCE'
 };
 console.log(JSON.stringify(report));
}
main(process.argv.slice(2)).catch(err=>{
 console.error(JSON.stringify({state:'REFUSED',code:err.code??'INTEROP_TEST_FAILURE',
   message:String(err.message??err),productionEligible:false}));
 process.exitCode=1;
});
