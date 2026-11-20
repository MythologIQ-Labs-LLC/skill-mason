/**
 * Trusted-backend-only bridge: one independently source-approved C4/C5 method
 * -> separately signed four facts -> actual pinned P0 guest -> sealed candidate.
 *
 * Neither a caller recipe nor the reviewed source may configure trust, sign
 * approvals, or set the external binding/asset digest pins. This interface
 * cannot establish legal rights by itself; authentic operator signoff and
 * source/host quality remain separate evidence and deployment gates.
 */
import {join,isAbsolute} from 'node:path';
import {createRecipeAdapter} from './recipe-adapter.mjs';
import {createComposer,readPackage,verifyPackage,writePackage} from './compose.mjs';
import {createPinnedPrismGuest} from './prism-guest.mjs';
import {createSourceBoundAssertionGuard,validateSourcePreflight}
  from '../../scripts/source_acceptance_gate.mjs';

export const OPERATOR_COMPOSITION_SCHEMA='qortara/operator-source-p0-composition/1';
const HEX=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const refuse=(code,message)=>{throw Object.assign(new Error(message),{code});};

/**
 * No fixture signer, minted rights, network discovery or user-provided
 * approvals. Inputs are supplied ONLY by an independently authenticated
 * coordinator. In particular, expected* pins must come from its own trust
 * store, not be copied from preflight or the method being checked.
 *
 * This release intentionally supports exactly one reviewed source method.
 * Multi-method approval requires independently bound C4 evidence per method.
 */
export async function composeOperatorBoundP0({
  sourceRegistry,recipe,preflight,operatorTrust,
  expectedSourceBindingSha256,expectedMethodSha256,expectedSnapshotSha256,
  readOperatorAcceptance,assertSignedMethod,holoPath,holoSha256,outputRoot,
  nowEpoch,loadRuntime
}={}){
  if(!HEX.test(expectedSourceBindingSha256??'')||
     !HEX.test(expectedMethodSha256??'')||
     !HEX.test(expectedSnapshotSha256??''))
    refuse('OPERATOR_PINS','three independent operator-custodied exact SHA-256 pins required');
  if(!plain(operatorTrust)||!plain(preflight)||
     typeof readOperatorAcceptance!=='function'||
     typeof assertSignedMethod!=='function')
    refuse('OPERATOR_TRUST','operator source trust, acceptance and signed-fact adapters required');
  if(typeof outputRoot!=='string'||!isAbsolute(outputRoot)||
     outputRoot.includes('\0')||outputRoot.length>2048)
    refuse('OUTPUT_ROOT','explicit absolute output parent required');
  if(!plain(sourceRegistry)||!plain(recipe))
    refuse('SOURCE_REGISTRY','trusted source registry and explicit recipe required');

  // Re-verify full package/method bytes via the existing immutable registry
  // adapter. Neither requested method ID nor a package hash admits source.
  const {plan,methods}=createRecipeAdapter(sourceRegistry)(recipe);
  if(methods.length!==1||plan.packagePins?.length!==1)
    refuse('METHOD_SET','only one independently accepted method per P0 candidate is supported');
  const method=methods[0],pin=plan.packagePins[0];
  const source=validateSourcePreflight(preflight,operatorTrust.scope);
  if(source.sourceBindingSha256!==expectedSourceBindingSha256||
     plan.sourceSnapshot.sha256!==expectedSnapshotSha256||
     method.sha256!==expectedMethodSha256||
     method.id!==source.governedId||
     pin.methodId!==method.id||pin.sha256!==expectedMethodSha256||
     plan.sourceSnapshot.commit!==source.snapshotCommit||
     plan.targetHost!==source.host)
    refuse('SOURCE_METHOD_MISMATCH',
      'operator-accepted source, package, snapshot, host and composed method must match exactly');

  // Strict source approval proof is verified before the second, unrelated
  // signed four-fact assertion. The actual P0 guest sees ONLY those four facts.
  const assertMethod=createSourceBoundAssertionGuard({
    preflight,trust:operatorTrust,readOperatorAcceptance,
    assertSignedMethod,...(nowEpoch?{nowEpoch}:{})
  });
  const runPrism=createPinnedPrismGuest({
    holoPath,holoSha256,developmentP0Consent:true,
    ...(loadRuntime?{loadRuntime}:{})
  });
  const packageValue=await createComposer({
    assertMethod,runPrism,holoSha256,
    sourceApprovalBindings:{[method.id]:expectedSourceBindingSha256}
  })(plan,methods);
  const receipt=JSON.parse(packageValue.files['RECEIPT.json']);
  const check=verifyPackage(packageValue);
  const claim=receipt.assertions?.[0];
  if(receipt.sourceApprovalRequired!==true||
     receipt.sourceApprovalState!==
       'PROOF_DIGESTS_RECORDED_SIGNATURES_REQUIRE_INDEPENDENT_REPLAY'||
     claim?.methodId!==method.id||
     claim.sourceBindingSha256!==expectedSourceBindingSha256||
     !HEX.test(claim.sourceAcceptanceProofSha256??'')||
     !HEX.test(claim.proofDigest??'')||
     check.sourceAcceptanceProofRecorded!==true||
     receipt.productionEligible!==false||receipt.hostValidated!==false)
    refuse('PROOF_PERSISTENCE','independent approvals were not preserved in strict P0 receipt');

  // Exclusive write; the existing sealed package reader revalidates the
  // complete file population and disk seal after the write.
  const destination=join(outputRoot,plan.name);
  await writePackage(packageValue,destination);
  const disk=await readPackage(destination);
  if(JSON.stringify(packageValue)!==JSON.stringify(disk)||
     verifyPackage(disk).packageSha256!==check.packageSha256)
    refuse('DISK_REPLAY','sealed output differs from trusted composition');
  return {
    schema:OPERATOR_COMPOSITION_SCHEMA,
    state:'STRICT_SIGNED_SOURCE_P0_DEVELOPMENT_CANDIDATE',
    methodId:method.id,sourceSnapshotCommit:source.snapshotCommit,
    sourceMethodSha256:method.sha256,
    sourceBindingSha256:source.sourceBindingSha256,
    sourceApprovalProofSha256:claim.sourceAcceptanceProofSha256,
    independentFourFactProofSha256:claim.proofDigest,
    packageManifestSha256:check.packageSha256,
    sealedOutput:destination,
    guestInvoked:true,guestAssurance:'P0 unverified',
    signedApprovalCheckedUsingConfiguredOperatorTrust:true,
    signedFourFactAdapterReturnedEvidence:true,
    signedFourFactSignatureIndependentlyReplayedByThisModule:false,
    externalTrustCustodyEstablishedByThisModule:false,
    legalSourceRightsIndependentlyEstablishedByThisModule:false,
    actualHostSkillExecutionObserved:false,
    sourceApprovalCanNeverOverrideFalseFacts:true,
    hostValidated:false,productionEligible:false
  };
}
