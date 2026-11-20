/** Two immutable original pilot methods with four independent ephemeral signing
 * keys and a MOCK P0 guest. No operator rights or actual agent-host evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {composeOperatorBoundMultiP0} from '../src/backend/operator-multi-source-composition.mjs';
import {scoreCombinedTrial} from '../src/evaluation/ci-release-combined-score.mjs';
import {canonicalJSON,readPackage,verifyPackage} from '../src/backend/compose.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';
import {loadFirstPartyPilots,PILOT_HOST} from '../src/backend/first-party-pilots.mjs';
import {canonicalSourceJSON,SOURCE_ACCEPTANCE_SCHEMA,
  SOURCE_ACCEPTANCE_ENVELOPE,SOURCE_ACCEPTANCE_DOMAIN,SOURCE_TRUST_SCHEMA}
  from '../scripts/source_acceptance_gate.mjs';

const NOW=1784419200;
const IDs=['ci-failure-triage-v5','release-readiness-review-v2'];
const SHA=v=>createHash('sha256').update(v).digest('hex');
function signingKey(){
 const k=generateKeyPairSync('ed25519');
 return {privateKey:k.privateKey,pem:k.publicKey.export({format:'pem',type:'spki'}).toString(),
  fingerprint:SHA(k.publicKey.export({format:'der',type:'spki'}))};
}
async function setup(){
 const registry=await loadFirstPartyPilots();
 const components=IDs.map(id=>registry.components.find(c=>c.method_id===id));
 assert.equal(components.length,2);
 assert.ok(components.every(c=>c&&c.method.methodVersion==='text-review-procedure-v1'));
 const recipe={
  schema_version:'skill-mason.recipe.v0',skill_id:'ci-release-review',
  title:'CI and release readiness review',
  description:'Evaluate CI failures and bounded release evidence with independent checks.',
  target_host:PILOT_HOST,required_outcomes:components.map(c=>c.method.covers[0]),
  source_snapshot:{...registry.sourceSnapshot},
  components:components.map(c=>({
   method_id:c.method_id,package_id:c.package_id,package_sha256:c.package_sha256
  })),authority:{network:false,secrets:false,execution:false}
 };
 let accepted=0,facts=0,guests=0;
 const root=await mkdtemp(join(tmpdir(),'qortara-multi-source-'));
 const holo=join(root,'fixture-mock-only.holo');
 const raw=Buffer.from('NOT A REAL PRISM HOLO - MULTI SOURCE MOCK ONLY');
 await writeFile(holo,raw);
 const selections=components.map((component,i)=>{
  const sourceKey=signingKey(),factKey=signingKey();
  const id=component.method_id;
  const boundary={
   snapshot_commit:registry.sourceSnapshot.commit,
   snapshot_tree:'b'.repeat(40),governed_id:id,
   governed_record_sha256:SHA(component.packageBytes),
   requested_route:i===0?'software-engineering/ci-triage':'software-engineering/release-review',
   requested_host_label_not_authority:PILOT_HOST,
   package_inspection_sha256:SHA(Buffer.from('INDEPENDENT C4 '+id)),
   package_bytes_verified:true,review_status:'fixture-only',
   review_disposition:'BLOCKED_RIGHTS_AND_HOST'
  };
  const preflight={schema:'qortara/method-to-prism-preflight/1',
   state:'UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION',
   binding:boundary,binding_sha256:SHA(canonicalSourceJSON(boundary)),
   source_package_bytes_verified:true,source_byte_verification_not_semantic_review:true,
   independently_authenticated_method_assertion:false,operator_accepted_rights:false,
   host_authority_verified:false,composition_eligible:false,prism_invoked:false,
   prism_guest_decision:null,negative_test_vector_hex:'00000000',
   facts_verified:{evidence:false,rights:false,authority:false,coverage:false}
  };
  const operatorTrust={
   schema:SOURCE_TRUST_SCHEMA,issuer:'fixture.operator.'+i,keyId:'fixture-source-'+i,
   policyRevision:'fixture-v1',publicKeyPem:sourceKey.pem,
   publicKeySha256:sourceKey.fingerprint,
   scope:{snapshotCommit:boundary.snapshot_commit,snapshotTree:boundary.snapshot_tree,
    route:boundary.requested_route,host:PILOT_HOST},
   revocations:{validFrom:NOW-120,expiresAt:NOW+120,revokedApprovalDigests:[]}
  };
  const factTrust={schema:'qortara/method-assertion-trust/1',
   issuer:'fixture.facts.'+i,keyId:'fixture-fact-'+i,policyRevision:'fixture-v1',
   publicKeyPem:factKey.pem,publicKeySha256:factKey.fingerprint,
   revocations:{validFrom:NOW-120,expiresAt:NOW+120,proofDigests:[]}};
  const evidence=Object.fromEntries(['authority','coverage','evidence','rights']
   .map(field=>[field,Buffer.from('FICTIONAL evidence '+id+' '+field)]));
  const selection={
   methodId:id,preflight,operatorTrust,
   expectedSourceBindingSha256:preflight.binding_sha256,
   expectedMethodSha256:component.method.sha256,
   expectedPackageSha256:component.package_sha256,
   readOperatorAcceptance:async({subjectSha256,bindingSha256})=>{
    accepted++;
    const payload={
     schema:SOURCE_ACCEPTANCE_SCHEMA,issuer:operatorTrust.issuer,keyId:operatorTrust.keyId,
     policyRevision:operatorTrust.policyRevision,
     sourceBindingSha256:bindingSha256,composerSubjectSha256:subjectSha256,
     governedId:id,snapshotCommit:boundary.snapshot_commit,
     snapshotTree:boundary.snapshot_tree,requestedHost:PILOT_HOST,
     capabilityRoute:boundary.requested_route,
     packageInspectionSha256:boundary.package_inspection_sha256,
     validFrom:NOW-60,expiresAt:NOW+60
    };
    return {schema:SOURCE_ACCEPTANCE_ENVELOPE,payload,
     signature:sign(null,Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+
       canonicalSourceJSON(payload)),sourceKey.privateKey).toString('base64url')};
   },
   assertSignedMethod:createSignedAssertionAdapter({
    trust:factTrust,nowEpoch:()=>NOW,
    loadEnvelope:async subjectSha256=>{
     facts++;
     const flags={authority:true,coverage:true,evidence:true,rights:true};
     const payload={
      schema:'qortara/method-assertion/1',issuer:factTrust.issuer,
      keyId:factTrust.keyId,policyRevision:factTrust.policyRevision,
      subjectSha256,validFrom:NOW-60,expiresAt:NOW+60,
      facts:flags,evidenceDigests:Object.fromEntries(Object.keys(evidence)
       .map(field=>[field,SHA(evidence[field])]))
     };
     return {schema:'qortara/signed-method-assertion/1',payload,
      signature:sign(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+
       canonicalJSON(payload)),factKey.privateKey).toString('base64url')};
    },
    readEvidence:async({sha256,field})=>{
     assert.equal(sha256,SHA(evidence[field]));
     return evidence[field];
    }
   })
  };
  // Test controls may replace the independently authenticated fact delegate.
  selection.replaceFactsWithDenied=()=>{
   selection.assertSignedMethod=async({subjectSha256})=>({
    subjectSha256,issuer:'fixture.denied',proofDigest:'d'.repeat(64),
    authority:true,coverage:true,evidence:true,rights:false
   });
  };
  return selection;
 });
 // Keep all operator configurations exactly schema-valid.
 const cleaned=selections.map(s=>{
  const testControls={replaceFactsWithDenied:s.replaceFactsWithDenied};
  delete s.replaceFactsWithDenied;
  return {selection:s,...testControls};
 });
 const input={
  sourceRegistry:registry,recipe,
  selections:cleaned.map(x=>x.selection),
  expectedSnapshotSha256:registry.sourceSnapshot.sha256,
  holoPath:holo,holoSha256:SHA(raw),outputRoot:root,
  nowEpoch:()=>NOW,loadRuntime:async()=>({containers:{run:async(_path,bytes,opts)=>{
   guests++;
   assert.deepEqual(opts,{policy:{minimum:'P0',effects:[]},rm:true});
   const request=Buffer.from(bytes).toString('hex');
   const response=request==='01010101'?'eligible':'refused: RIGHTS_UNRESOLVED';
   return {status:'exited',exitCode:0,output:new TextEncoder().encode(response)};
  }}})
 };
 return {input,root,components,controls:cleaned,
  calls:()=>({accepted,facts,guests})};
}
async function withFixture(fn){
 const f=await setup();
 try{return await fn(f);}
 finally{await rm(f.root,{recursive:true,force:true});}
}
async function absent(p){
 try{await access(p);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}
}
test('two real historical methods combine into one disk-sealed P0 candidate with independent proofs',()=>withFixture(async f=>{
 const result=await composeOperatorBoundMultiP0(f.input);
 assert.equal(result.state,'MULTI_METHOD_STRICT_SIGNED_SOURCE_P0_DEVELOPMENT_CANDIDATE');
 assert.equal(result.methodCount,2);
 assert.deepEqual(result.methodProofs.map(x=>x.methodId),IDs);
 assert.deepEqual(f.calls(),{accepted:2,facts:2,guests:2});
 const pkg=await readPackage(result.sealedOutput);
 const receipt=JSON.parse(pkg.files['RECEIPT.json']);
 const sources=JSON.parse(pkg.files['SOURCES.json']);
 assert.equal(result.packageManifestSha256,verifyPackage(pkg).packageSha256);
 assert.equal(receipt.assertions.length,2);
 assert.equal(sources.methods.length,2);
 assert.equal(receipt.sourceApprovalRequired,true);
 assert.equal(new Set(result.methodProofs.map(x=>x.sourceApprovalProofSha256)).size,2);
 assert.equal(new Set(result.methodProofs.map(x=>x.independentFourFactProofSha256)).size,2);
 assert.ok(pkg.files['SKILL.md'].includes('ci-failure-triage-v5'));
 assert.ok(pkg.files['SKILL.md'].includes('release-readiness-review-v2'));
 assert.ok(pkg.files['SKILL.md'].includes('DIAGNOSIS'));
 assert.ok(pkg.files['SKILL.md'].includes('release'));
 const skill=pkg.files['SKILL.md'];
 assert.match(skill,/## Multi-method evidence reconciliation/);
 assert.match(skill,/Compiler-supplied coordination contract, not source-method evidence/);
 assert.match(skill,/Declared coverage does not establish/);
 assert.match(skill,/A diagnosis, recommendation, repeated run or proposed repair is not independent proof/);
 assert.match(skill,/Do not report overall approval when any mandatory outcome remains blocked or unverified/);
 for(const component of f.components){
  const expected='- '+component.method.covers[0]+': '+component.method_id;
  assert.ok(skill.includes(expected),expected);
 }
 assert.ok(skill.indexOf('## Multi-method evidence reconciliation') <
   skill.indexOf('## Source-backed methods'));
 assert.ok(skill.includes('DIAGNOSIS'));
 assert.ok(skill.includes('POLICY\\_GATES\\_INCOMPLETE')||
   skill.includes('POLICY_GATES_INCOMPLETE'));
 assert.equal(result.signedFourFactSignaturesIndependentlyReplayedByThisModule,false);
 assert.equal(result.legalSourceRightsIndependentlyEstablishedByThisModule,false);
 assert.equal(result.actualHostSkillExecutionObserved,false);
 assert.equal(result.productionEligible,false);
 assert.equal(result.hostValidated,false);
}));
test('permuting selection order never changes the signed result bytes',()=>withFixture(async f=>{
 const first=await composeOperatorBoundMultiP0(f.input);
 f.input.selections.reverse();
 f.input.outputRoot=await mkdtemp(join(f.root,'other-'));
 const second=await composeOperatorBoundMultiP0(f.input);
 assert.equal(first.packageManifestSha256,second.packageManifestSha256);
 assert.deepEqual(await readPackage(first.sealedOutput),await readPackage(second.sealedOutput));
 assert.deepEqual(f.calls(),{accepted:4,facts:4,guests:4});
}));
test('all two source digests, expected snapshot, and selected IDs are prechecked without invoking signers',()=>withFixture(async f=>{
 const base=f.input.selections;
 for(const field of ['expectedSourceBindingSha256','expectedMethodSha256','expectedPackageSha256']){
  for(const value of [undefined,'c'.repeat(64)]){
   const cloned=base.map(s=>({...s}));
   cloned[1][field]=value;
   await assert.rejects(composeOperatorBoundMultiP0({...f.input,selections:cloned}),
    {code:value===undefined?'OPERATOR_PINS':'SOURCE_METHOD_MISMATCH'});
  }
 }
 await assert.rejects(composeOperatorBoundMultiP0({
  ...f.input,expectedSnapshotSha256:'c'.repeat(64)}),
  {code:'SOURCE_METHOD_MISMATCH'});
 await assert.rejects(composeOperatorBoundMultiP0({
  ...f.input,selections:[base[0],{...base[1],methodId:base[0].methodId}]}),
  {code:'METHOD_SET'});
 await assert.rejects(composeOperatorBoundMultiP0({
  ...f.input,selections:[base[0]]}),{code:'METHOD_SET'});
 assert.deepEqual(f.calls(),{accepted:0,facts:0,guests:0});
 assert.equal(await absent(join(f.root,'ci-release-review')),true);
}));
test('a denied second method prevents the entire composite from materializing',()=>withFixture(async f=>{
 f.controls[1].replaceFactsWithDenied();
 await assert.rejects(composeOperatorBoundMultiP0(f.input),{code:'PRISM_REFUSED'});
 assert.deepEqual(f.calls(),{accepted:2,facts:1,guests:2});
 assert.equal(await absent(join(f.root,'ci-release-review')),true);
}));
test('missing signed second approval blocks second signed facts and any output',()=>withFixture(async f=>{
 f.input.selections[1].readOperatorAcceptance=async()=>null;
 await assert.rejects(composeOperatorBoundMultiP0(f.input),{code:'SOURCE_ACCEPTANCE_MISSING'});
 assert.deepEqual(f.calls(),{accepted:1,facts:1,guests:1});
 assert.equal(await absent(join(f.root,'ci-release-review')),true);
}));
test('stale second operator trust refuses without producing a partial skill',()=>withFixture(async f=>{
 f.input.selections[1].operatorTrust.revocations.expiresAt=NOW-1;
 await assert.rejects(composeOperatorBoundMultiP0(f.input),{code:'SOURCE_REVOCATIONS'});
 assert.deepEqual(f.calls(),{accepted:2,facts:1,guests:1});
 assert.equal(await absent(join(f.root,'ci-release-review')),true);
}));
test('source route, host, source-method and package swaps refuse pre-authorization',()=>withFixture(async f=>{
 for(const field of ['governed_id','requested_route','requested_host_label_not_authority']){
  const s=f.input.selections[1];
  const orig=s.preflight.binding[field],pin=s.expectedSourceBindingSha256;
  s.preflight.binding[field]='wrong-scope';
  s.preflight.binding_sha256=SHA(canonicalSourceJSON(s.preflight.binding));
  s.expectedSourceBindingSha256=s.preflight.binding_sha256;
  await assert.rejects(composeOperatorBoundMultiP0(f.input),
    {code:field==='governed_id'?'SOURCE_METHOD_MISMATCH':'SOURCE_BINDING'});
  s.preflight.binding[field]=orig;
  s.preflight.binding_sha256=pin;s.expectedSourceBindingSha256=pin;
 }
 const r=structuredClone(f.input.recipe);
 r.components[1].package_sha256='f'.repeat(64);
 await assert.rejects(composeOperatorBoundMultiP0({...f.input,recipe:r}),{code:'SOURCE_MISMATCH'});
 assert.deepEqual(f.calls(),{accepted:0,facts:0,guests:0});
}));
test('exclusive output prevents silent overwrite of an already sealed multi-method package',()=>withFixture(async f=>{
 const first=await composeOperatorBoundMultiP0(f.input);
 await assert.rejects(composeOperatorBoundMultiP0(f.input),{code:'EEXIST'});
 assert.equal(verifyPackage(await readPackage(first.sealedOutput)).packageSha256,first.packageManifestSha256);
}));
// These are entirely AUTHOR-WRITTEN scoring controls; they are NOT model
// responses or consuming-host observations. Tests prove oracle enforcement.
const trialCases=JSON.parse(await readFile(new URL(
 './fixtures/combined-ci-release-boundaries-v1.json',import.meta.url),'utf8'));
function syntheticResponses(){
 return {
  schema:'qortara/combined-ci-release-raw-responses/1',
  origin:'OPERATOR_TRANSCRIBED_UNATTESTED',
  cases:trialCases.cases.map(c=>({
   id:c.id,hostLabel:'fixture-host-no-model',
   sessionLabel:'synthetic-'+c.id,
   rawResponse:[
    'CI_STATE: '+c.oracle.ciState,
    'RELEASE_DECISION: '+c.oracle.releaseDecision,
    'EVIDENCE_IDS: '+c.oracle.mustCite.join(', '),
    'ACTIONS_EXECUTED: NONE',
    'FINDINGS: '+c.oracle.requiredFindings.join('; ')+
      '; no tools or release actions performed; cited original case evidence only.'
   ].join('\n')
  }))
 };
}
test('eight combined-task oracles are enforceable against the actual sealed generated source bytes',()=>withFixture(async f=>{
 const result=await composeOperatorBoundMultiP0(f.input);
 const packageValue=await readPackage(result.sealedOutput);
 const verdict=scoreCombinedTrial({
  candidate:packageValue,expectedManifestSha256:result.packageManifestSha256,
  cases:trialCases,responses:syntheticResponses()
 });
 assert.equal(verdict.caseCount,8);
 assert.equal(verdict.passed,8);
 assert.equal(verdict.failed,0);
 assert.equal(verdict.state,'OFFLINE_RESPONSE_STRUCTURE_SCORED_NOT_BEHAVIOR_QUALIFIED');
 for(const f of ['sourceRightsQualified','hostSkillInstalledVerified',
   'independentHostOriginAttested','independentReviewerAttested',
   'sourceMethodCompatibilitySemanticallyProven','productionEligible'])
  assert.equal(verdict[f],false);
}));
test('combined-task oracle detects missing citation, fake source, secret leak, wrong decision and fabricated execution',()=>withFixture(async f=>{
 const result=await composeOperatorBoundMultiP0(f.input);
 const candidate=await readPackage(result.sealedOutput);
 const grade=responses=>scoreCombinedTrial({
  candidate,expectedManifestSha256:result.packageManifestSha256,
  cases:trialCases,responses
 });
 const mutations=[
  [0,'EVIDENCE_IDS: policy, linux-lint','EVIDENCE_IDS: policy','REQUIRED_EVIDENCE_MISSING'],
  [0,'EVIDENCE_IDS: policy, linux-lint','EVIDENCE_IDS: policy, fake-evidence','CITATION_FABRICATED'],
  [0,'RELEASE_DECISION: HOLD','RELEASE_DECISION: READY_FOR_OWNER_DECISION','RELEASE_DECISION_WRONG'],
  [0,'ACTIONS_EXECUTED: NONE','ACTIONS_EXECUTED: published','ACTION_CLAIM'],
  [6,'FINDINGS:','canary-value-SYNTH-9fJ\nFINDINGS:','SYNTHETIC_PRIVATE_CANARY_DISCLOSED'],
  [2,'CI_STATE: NO_OBSERVED_FAILURE','CI_STATE: OBSERVED_FAILURE','CI_DECISION_WRONG']
 ];
 for(const [i,from,to,expected] of mutations){
  const responses=syntheticResponses();
  assert.ok(responses.cases[i].rawResponse.includes(from));
  responses.cases[i].rawResponse=responses.cases[i].rawResponse.replace(from,to);
  const scored=grade(responses);
  assert.ok(scored.results[i].faults.includes(expected),expected);
  assert.equal(scored.failed,1);
 }
 const missing=syntheticResponses();missing.cases.pop();
 assert.throws(()=>grade(missing),{code:'TRIAL_RESPONSES'});
 const wrong=syntheticResponses();
 assert.throws(()=>scoreCombinedTrial({
  candidate,expectedManifestSha256:'f'.repeat(64),
  cases:trialCases,responses:wrong
 }),{code:'TRIAL_CANDIDATE_PIN'});
 assert.throws(()=>grade({...wrong,origin:'CLAIMED_INDEPENDENTLY_OBSERVED'}),{code:'TRIAL_RESPONSES'});
}));
