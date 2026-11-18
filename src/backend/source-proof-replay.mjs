/**
 * Replay of a hash-sealed STRICT P0 source receipt through operator-owned
 * source-signature, four-fact evidence and exact Prism-guest verifiers.
 *
 * Every callback must be independently configured outside the package.
 * Nothing in RECEIPT.json may bootstrap its own signer or authority.
 * This module does not know whether an external callback is trustworthy.
 */
import {verifyPackage} from './compose.mjs';

const HEX=/^[a-f0-9]{64}$/;
const sha=x=>typeof x==='string'&&HEX.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const fail=(code,message)=>{
 const e=new Error(message);e.name='ReceiptReplayRefusal';e.code=code;throw e;
};
const fields=['evidence','rights','authority','coverage'];
export async function replaySealedSourceReceipt(pkg,{
 expectedSourceBindings,expectedHoloSha256,
 verifySourceAcceptance,verifySignedMethod,runPrism
}={}){
 // Reject malformed package/digest before invoking any independently
 // operator-configured verifier.
 const shape=verifyPackage(pkg);
 if(shape.sourceAcceptanceProofRecorded!==true)
  fail('SOURCE_REPLAY_REQUIRED','strict source approval receipt is missing');
 if(!sha(expectedHoloSha256)||!plain(expectedSourceBindings)||
    typeof verifySourceAcceptance!=='function'||
    typeof verifySignedMethod!=='function'||typeof runPrism!=='function')
  fail('REPLAY_CONFIG','operator trust, revocations, guest and exact source bindings required');
 const receipt=JSON.parse(pkg.files['RECEIPT.json']);
 const source=JSON.parse(pkg.files['SOURCES.json']);
 const entries=receipt.assertions;
 if(Object.keys(expectedSourceBindings).length!==entries.length||
    entries.some(x=>!Object.hasOwn(expectedSourceBindings,x.methodId)||
      !sha(expectedSourceBindings[x.methodId])))
  fail('REPLAY_CONFIG','every method must have exactly one operator-pinned source digest');
 const reviews=[];
 for(const claim of entries){
  if(claim.sourceBindingSha256!==expectedSourceBindings[claim.methodId]||
     claim.verdict?.requestHex!=='01010101'||
     claim.verdict?.guestSha256!==expectedHoloSha256)
   fail('REPLAY_SCOPE','source or pinned guest differs from accepted replay scope');
  // Only the caller's independent operator-trust verifier may read and check
  // an original Ed25519 approval. A digest in this file is NEVER approval.
  const sourceApproval=await verifySourceAcceptance({
   methodId:claim.methodId,subjectSha256:claim.subjectSha256,
   sourceBindingSha256:claim.sourceBindingSha256,
   approvalProofSha256:claim.sourceAcceptanceProofSha256});
  if(!plain(sourceApproval)||
     sourceApproval.state!=='OPERATOR_SOURCE_BINDING_SIGNATURE_VALID'||
     sourceApproval.sourceBindingSha256!==claim.sourceBindingSha256||
     sourceApproval.composerSubjectSha256!==claim.subjectSha256||
     sourceApproval.acceptanceProofSha256!==claim.sourceAcceptanceProofSha256||
     sourceApproval.signatureAuthenticatesOnlyIssuerClaim!==true||
     sourceApproval.productionEligible!==false)
   fail('SOURCE_REPLAY_MISMATCH','operator acceptance failed exact proof/subject replay');
  // Existing createSignedAssertionAdapter independently verifies its trusted
  // Ed25519 issuer, fresh revocations, source subject, evidence bytes/digests.
  const facts=await verifySignedMethod({subjectSha256:claim.subjectSha256});
  if(!plain(facts)||facts.subjectSha256!==claim.subjectSha256||
     facts.proofDigest!==claim.proofDigest||facts.issuer!==claim.issuer||
     fields.some(k=>facts[k]!==true))
   fail('ASSERTION_REPLAY_MISMATCH','signed four-fact assertion was revoked, altered or incomplete');
  const guest=await runPrism({
   requestHex:'01010101',holoSha256:expectedHoloSha256});
  if(!plain(guest)||guest.schema!=='qortara/local-eligibility-result/1'||
     guest.status!=='GUEST_COMPLETED'||
     guest.application!=='Qortara Skills Eligibility'||
     guest.engine!=='prism-code@0.9.5'||
     guest.requestHex!=='01010101'||guest.response!=='eligible'||
     guest.responseHex!=='656c696769626c65'||guest.exitCode!==0||
     guest.productionEligible!==false||
     !plain(guest.artifact)||guest.artifact.sha256!==expectedHoloSha256)
   fail('PRISM_REPLAY_MISMATCH','trusted guest did not repeat expected pinned P0 decision');
  reviews.push({
   methodId:claim.methodId,
   sourceBindingSha256:claim.sourceBindingSha256,
   sourceApprovalProofSha256:claim.sourceAcceptanceProofSha256,
   signedFourFactProofSha256:claim.proofDigest,
   assuranceSubjectSha256:claim.subjectSha256,
   guestSha256:expectedHoloSha256,
   sourceSignatureReplayedByOperatorAdapter:true,
   signedFourFactsReplayedByOperatorAdapter:true,
   pinnedGuestDecisionReplayedByOperatorAdapter:true
  });
 }
 return {
  schema:'qortara/source-receipt-p0-replay/1',
  state:'P0_DEVELOPMENT_RECEIPT_REPLAYED_BY_CONFIGURED_ADAPTERS',
  receiptMethodCount:reviews.length,methods:reviews,
  proofBytesNotStoredInPackage:true,
  independentOperatorTrustStillRequired:true,
  rightsOrBehavioralTruthEstablishedByThisModule:false,
  replayResultIsNotP2Proof:true,
  productionEligible:false,hostValidated:false,
  sourcePackageInstalled:false
 };
}
