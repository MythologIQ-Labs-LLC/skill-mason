/**
 * Trusted-backend-only multi-method development composition.
 *
 * A method may enter a combined skill only after its OWN original package
 * pin, C4/C5 source preflight, operator Ed25519 acceptance and independently
 * signed four-fact assertion. No caller-supplied recipe can mint those facts.
 * Every accepted method runs through the actual pinned P0 guest separately.
 *
 * This does not establish real legal rights, publisher trust custody, Prism P2,
 * consuming-host quality or production eligibility. No public CLI exposure.
 */
import {join,isAbsolute} from 'node:path';
import {createRecipeAdapter} from './recipe-adapter.mjs';
import {createComposer,readPackage,verifyPackage,writePackage} from './compose.mjs';
import {createPinnedPrismGuest} from './prism-guest.mjs';
import {createSourceBoundAssertionGuard,validateSourcePreflight}
  from '../../scripts/source_acceptance_gate.mjs';

export const MULTI_SOURCE_COMPOSITION_SCHEMA='qortara/operator-multi-source-p0-composition/1';
const HEX=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const refuse=(code,message)=>{throw Object.assign(new Error(message),{code});};
const validHex=v=>typeof v==='string'&&HEX.test(v);
const keys=(v,expected)=>plain(v)&&
  Object.keys(v).sort().join('|')===[...expected].sort().join('|');

/**
 * A caller is an independently authenticated backend coordinator, never an
 * untrusted web/CLI request. Each selection MUST have its own source preflight,
 * independently held pins, operator trust root/resolver, and four-fact verifier.
 * The common snapshot digest is separately pinned by the coordinator.
 */
export async function composeOperatorBoundMultiP0({
  sourceRegistry,recipe,selections,expectedSnapshotSha256,
  holoPath,holoSha256,outputRoot,nowEpoch,loadRuntime
}={}){
  if(!plain(sourceRegistry)||!plain(recipe))
    refuse('SOURCE_REGISTRY','trusted source registry and explicit recipe required');
  if(!validHex(expectedSnapshotSha256)||!validHex(holoSha256))
    refuse('OPERATOR_PINS','independent snapshot digest and pinned guest digest required');
  if(!Array.isArray(selections)||selections.length<2||selections.length>16)
    refuse('METHOD_SET','between two and sixteen independently accepted method sources required');
  if(typeof outputRoot!=='string'||!isAbsolute(outputRoot)||
     outputRoot.includes('\0')||outputRoot.length>2048)
    refuse('OUTPUT_ROOT','explicit absolute output parent required');

  // Independently rehash all method and complete original package bytes.
  // Adaptation also enforces exact declared essential outcome coverage, the
  // common immutable snapshot, target-host contract, and no execution rights.
  const {plan,methods}=createRecipeAdapter(sourceRegistry)(recipe);
  if(methods.length!==selections.length||plan.packagePins?.length!==methods.length)
    refuse('METHOD_SET','exactly one independent approval for every selected source method required');
  if(plan.sourceSnapshot.sha256!==expectedSnapshotSha256)
    refuse('SOURCE_METHOD_MISMATCH','snapshot digest differs from independent coordinator pin');

  const methodById=new Map(methods.map(m=>[m.id,m]));
  const packageById=new Map(plan.packagePins.map(p=>[p.methodId,p]));
  const accepted=new Map();
  // All pins and preflights must match BEFORE any operator signer, four-fact
  // resolver, Prism guest or output write is consulted.
  for(const s of selections){
    if(!keys(s,['methodId','preflight','operatorTrust',
      'expectedSourceBindingSha256','expectedMethodSha256',
      'expectedPackageSha256','readOperatorAcceptance','assertSignedMethod']))
      refuse('METHOD_SOURCE_CONFIG','complete per-method independent trust configuration required');
    if(typeof s.methodId!=='string'||!methodById.has(s.methodId)||
       accepted.has(s.methodId))
      refuse('METHOD_SET','unknown, duplicate or cross-selected source method');
    if(!validHex(s.expectedSourceBindingSha256)||
       !validHex(s.expectedMethodSha256)||!validHex(s.expectedPackageSha256))
      refuse('OPERATOR_PINS','independent binding, method and package digest required for each method');
    if(!plain(s.operatorTrust)||!plain(s.preflight)||
       typeof s.readOperatorAcceptance!=='function'||
       typeof s.assertSignedMethod!=='function')
      refuse('OPERATOR_TRUST','independent operator trust, acceptance and fact verifier required for every method');
    const method=methodById.get(s.methodId),pin=packageById.get(s.methodId);
    const source=validateSourcePreflight(s.preflight,s.operatorTrust.scope);
    if(source.sourceBindingSha256!==s.expectedSourceBindingSha256||
       method.sha256!==s.expectedMethodSha256||
       pin?.sha256!==s.expectedPackageSha256||pin.methodId!==method.id||
       source.governedId!==method.id||
       source.snapshotCommit!==plan.sourceSnapshot.commit||
       source.host!==plan.targetHost)
      refuse('SOURCE_METHOD_MISMATCH','one method, package, snapshot, source scope or host was substituted');
    accepted.set(s.methodId,{selection:s,source,method,pin});
  }
  if(accepted.size!==methods.length)
    refuse('METHOD_SET','each selected method must have its own exact operator binding');

  // Snapshot trust/preflight before the first asynchronous callback. A later
  // caller mutation must not change what was authorized for another method.
  const guards=new Map();
  for(const [id,entry] of accepted){
    const s=entry.selection;
    guards.set(id,createSourceBoundAssertionGuard({
      preflight:s.preflight,trust:s.operatorTrust,
      readOperatorAcceptance:s.readOperatorAcceptance,
      assertSignedMethod:s.assertSignedMethod,
      ...(nowEpoch?{nowEpoch}:{})
    }));
  }
  const sourceApprovalBindings=Object.fromEntries(
    [...accepted].map(([id,e])=>[id,e.source.sourceBindingSha256]));
  const assertMethod=async({recipe:planArg,method,subjectSha256})=>{
    const guard=guards.get(method.id);
    if(!guard)refuse('METHOD_SET','composer requested a nonaccepted method');
    return guard({recipe:planArg,method,subjectSha256});
  };
  const runPrism=createPinnedPrismGuest({
    holoPath,holoSha256,developmentP0Consent:true,
    ...(loadRuntime?{loadRuntime}:{})
  });
  const result=await createComposer({
    assertMethod,runPrism,holoSha256,sourceApprovalBindings
  })(plan,methods);
  const verified=verifyPackage(result);
  const receipt=JSON.parse(result.files['RECEIPT.json']);
  if(receipt.sourceApprovalRequired!==true||
     receipt.sourceApprovalState!==
       'PROOF_DIGESTS_RECORDED_SIGNATURES_REQUIRE_INDEPENDENT_REPLAY'||
     receipt.productionEligible!==false||receipt.hostValidated!==false||
     receipt.assertions?.length!==accepted.size||
     verified.sourceAcceptanceProofRecorded!==true)
    refuse('PROOF_PERSISTENCE','multi-method P0 receipt did not preserve exact independent proofs');

  const proofById=new Map();
  for(const claim of receipt.assertions){
    const expected=accepted.get(claim.methodId);
    if(!expected||proofById.has(claim.methodId)||
       claim.sourceBindingSha256!==expected.source.sourceBindingSha256||
       !validHex(claim.sourceAcceptanceProofSha256)||
       !validHex(claim.proofDigest))
      refuse('PROOF_PERSISTENCE','one method lacks its own source and four-fact proof');
    proofById.set(claim.methodId,claim);
  }
  if(proofById.size!==accepted.size)
    refuse('PROOF_PERSISTENCE','signed method population differs from selected source population');

  // Persist only after ALL methods and guests succeed, without overwriting
  // any previous candidate. Independently reread the sealed bytes.
  const destination=join(outputRoot,plan.name);
  await writePackage(result,destination);
  const disk=await readPackage(destination);
  if(JSON.stringify(result)!==JSON.stringify(disk)||
     verifyPackage(disk).packageSha256!==verified.packageSha256)
    refuse('DISK_REPLAY','sealed multi-method candidate differs from composed bytes');

  const methodProofs=[...accepted.values()].map(({method,pin,source})=>{
    const claim=proofById.get(method.id);
    return Object.freeze({
      methodId:method.id,originalMethodSha256:method.sha256,
      originalPackageSha256:pin.sha256,
      sourceBindingSha256:source.sourceBindingSha256,
      sourceApprovalProofSha256:claim.sourceAcceptanceProofSha256,
      independentFourFactProofSha256:claim.proofDigest
    });
  }).sort((a,b)=>a.methodId.localeCompare(b.methodId));
  return {
    schema:MULTI_SOURCE_COMPOSITION_SCHEMA,
    state:'MULTI_METHOD_STRICT_SIGNED_SOURCE_P0_DEVELOPMENT_CANDIDATE',
    sourceSnapshotCommit:plan.sourceSnapshot.commit,
    sourceSnapshotSha256:plan.sourceSnapshot.sha256,
    methodProofs,methodCount:methodProofs.length,
    packageManifestSha256:verified.packageSha256,sealedOutput:destination,
    guestDecisionsPerMethod:true,guestAssurance:'P0 unverified',
    sourceSignatureVerificationByConfiguredOperatorTrust:true,
    signedFourFactEvidenceProvidedByIndependentAdapters:true,
    signedFourFactSignaturesIndependentlyReplayedByThisModule:false,
    externalTrustCustodyEstablishedByThisModule:false,
    legalSourceRightsIndependentlyEstablishedByThisModule:false,
    actualHostSkillExecutionObserved:false,
    hostValidated:false,productionEligible:false
  };
}
