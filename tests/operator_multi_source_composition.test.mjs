/** Two immutable original pilot methods with four independent ephemeral signing
 * keys and a MOCK P0 guest. No operator rights or actual agent-host evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {composeOperatorBoundMultiP0} from '../src/backend/operator-multi-source-composition.mjs';
import {composeOperatorBoundP0} from '../src/backend/operator-source-composition.mjs';
import {scoreFourArmTrial,prepareFourArmPrompts}
 from '../src/evaluation/ci-release-combined-score.mjs';
import {prepareBlindReview,adjudicateBlindReview}
 from '../src/evaluation/four-arm-blind-review.mjs';
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
test('actual read-only CLI checks a sealed two-source candidate and exits nonzero on failed task',()=>withFixture(async f=>{
 const result=await composeOperatorBoundMultiP0(f.input);
 const answerPath=join(f.root,'operator-recorded-responses.json');
 const casesPath=fileURLToPath(new URL(
  './fixtures/combined-ci-release-boundaries-v1.json',import.meta.url));
 const args=[
  fileURLToPath(new URL('../bin/combined-ci-release-offline-score.mjs',import.meta.url)),
  '--candidate-dir',result.sealedOutput,
  '--expected-package-sha256',result.packageManifestSha256,
  '--cases',casesPath,'--responses',answerPath
 ];
 await writeFile(answerPath,JSON.stringify(syntheticResponses())+'\n');
 const pass=spawnSync(process.execPath,args,{encoding:'utf8',timeout:20_000});
 assert.equal(pass.status,0,pass.stderr);
 const positive=JSON.parse(pass.stdout);
 assert.equal(positive.passed,8);
 assert.equal(positive.independentHostOriginAttested,false);
 const denied=syntheticResponses();
 denied.cases[0].rawResponse=denied.cases[0].rawResponse.replace(
  'RELEASE_DECISION: HOLD','RELEASE_DECISION: READY_FOR_OWNER_DECISION');
 await writeFile(answerPath,JSON.stringify(denied)+'\n');
 const fail=spawnSync(process.execPath,args,{encoding:'utf8',timeout:20_000});
 assert.equal(fail.status,2,fail.stderr);
 assert.equal(JSON.parse(fail.stdout).failed,1);
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

async function buildFourArms(f){
 const multi=await composeOperatorBoundMultiP0(f.input);
 const combined={candidate:await readPackage(multi.sealedOutput),
  expectedManifestSha256:multi.packageManifestSha256};
 const artifacts={baseline:null,combined};
 const map=[['ci_only',0],['release_only',1]];
 for(const [arm,i] of map){
  const selected=f.input.selections[i];
  const source=f.components[i];
  const recipe={...f.input.recipe,skill_id:source.method_id,
   required_outcomes:[source.method.covers[0]],
   components:[f.input.recipe.components[i]]};
  const outputRoot=await mkdtemp(join(f.root,arm+'-'));
  const result=await composeOperatorBoundP0({
   sourceRegistry:f.input.sourceRegistry,recipe,
   preflight:selected.preflight,operatorTrust:selected.operatorTrust,
   expectedSourceBindingSha256:selected.expectedSourceBindingSha256,
   expectedMethodSha256:selected.expectedMethodSha256,
   expectedPackageSha256:selected.expectedPackageSha256,
   expectedSnapshotSha256:f.input.expectedSnapshotSha256,
   readOperatorAcceptance:selected.readOperatorAcceptance,
   assertSignedMethod:selected.assertSignedMethod,
   holoPath:f.input.holoPath,holoSha256:f.input.holoSha256,outputRoot,
   nowEpoch:f.input.nowEpoch,loadRuntime:f.input.loadRuntime
  });
  artifacts[arm]={candidate:await readPackage(result.sealedOutput),
   expectedManifestSha256:result.packageManifestSha256};
 }
 return artifacts;
}
function preparedFourResponses(){
 const arms={};
 for(const arm of ['baseline','ci_only','release_only','combined']){
  const answers=syntheticResponses();
  answers.cases=answers.cases.map(rec=>({...rec,
   hostLabel:'fixture-host-not-an-independent-agent',
   sessionLabel:arm+'-'+rec.id}));
  arms[arm]=answers;
 }
 return arms;
}
test('four exact pinned original-source packages score identical tasks with paired loss/win/tie accounting',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const responses=preparedFourResponses();
 const scored=scoreFourArmTrial({cases:trialCases,arms:responses,artifacts});
 assert.equal(scored.caseCount,8);
 assert.deepEqual(Object.values(scored.summary).map(x=>x.passed),[8,8,8,8]);
 assert.equal(scored.paired.combined_vs_baseline.ties,8);
 assert.equal(scored.paired.combined_vs_ci_only.combinedWins,0);
 assert.equal(scored.combinedVsPerCaseBestSingle.ties,8);
 assert.equal(scored.capturedHostOriginCryptographicallyVerified,false);
 assert.equal(scored.causalBehavioralImprovementProven,false);
 assert.equal(scored.productionEligible,false);
 const packageSha=new Set(Object.values(scored.candidateManifestSha256ByArm).filter(Boolean));
 assert.equal(packageSha.size,3);
 assert.equal(verifyPackage(artifacts.ci_only.candidate).state,'INTEGRITY_VERIFIED');
 assert.equal(verifyPackage(artifacts.release_only.candidate).state,'INTEGRITY_VERIFIED');
 assert.equal(verifyPackage(artifacts.combined.candidate).state,'INTEGRITY_VERIFIED');
 const task=prepareFourArmPrompts({cases:trialCases,artifacts});
 assert.equal(task.tasks.length,32);
 assert.equal(task.oracleLabelsIncluded,false);
 assert.equal(task.hostInvoked,false);
 assert.equal(task.tasks.filter(x=>x.skillInstructions===null).length,8);
 assert.equal(task.tasks.filter(x=>x.arm==='combined').length,8);
 assert.ok(task.tasks.every(x=>!Object.hasOwn(x,'oracle')));
 assert.ok(task.tasks.every(x=>!x.taskPrompt.includes('requiredFindings')));
 assert.ok(task.tasks.find(x=>x.arm==='combined').skillInstructions
   .includes('## Multi-method evidence reconciliation'));
 assert.ok(!task.tasks.find(x=>x.arm==='ci_only').skillInstructions
   .includes('## Multi-method evidence reconciliation'));
}));
test('a real four-arm comparison cannot hide combined losses or invent quality wins',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const responses=preparedFourResponses();
 const wrong=responses.combined.cases[0];
 wrong.rawResponse=wrong.rawResponse.replace('RELEASE_DECISION: HOLD',
  'RELEASE_DECISION: READY_FOR_OWNER_DECISION');
 const grade=()=>scoreFourArmTrial({cases:trialCases,arms:responses,artifacts});
 let result=grade();
 assert.equal(result.summary.combined.failed,1);
 assert.equal(result.paired.combined_vs_baseline.alternativeWins,1);
 assert.equal(result.paired.combined_vs_release_only.alternativeWins,1);
 assert.equal(result.combinedVsPerCaseBestSingle.bestSingleWins,1);
 assert.ok(result.results.combined[0].faults.includes('RELEASE_DECISION_WRONG'));
 responses.baseline.cases[1].rawResponse=responses.baseline.cases[1].rawResponse
   .replace('RELEASE_DECISION: EVIDENCE_INCOMPLETE','RELEASE_DECISION: HOLD');
 responses.ci_only.cases[1].rawResponse=responses.ci_only.cases[1].rawResponse
   .replace('RELEASE_DECISION: EVIDENCE_INCOMPLETE','RELEASE_DECISION: HOLD');
 responses.release_only.cases[1].rawResponse=responses.release_only.cases[1].rawResponse
   .replace('RELEASE_DECISION: EVIDENCE_INCOMPLETE','RELEASE_DECISION: HOLD');
 result=grade();
 assert.equal(result.paired.combined_vs_baseline.combinedWins,1);
 assert.equal(result.combinedVsPerCaseBestSingle.combinedWins,1);
 assert.equal(result.combinedVsPerCaseBestSingle.bestSingleWins,1);
 assert.equal(result.causalBehavioralImprovementProven,false);
}));
test('four-arm input refuses fake method, counterfeit package pin and noncomparable sessions',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const responses=preparedFourResponses();
 const grade=(a=artifacts,r=responses)=>scoreFourArmTrial({cases:trialCases,arms:r,artifacts:a});
 const swap={...artifacts,ci_only:artifacts.release_only};
 assert.throws(()=>grade(swap),{code:'TRIAL_CANDIDATE_SOURCE'});
 const bad={...artifacts,ci_only:{...artifacts.ci_only,expectedManifestSha256:'f'.repeat(64)}};
 assert.throws(()=>grade(bad),{code:'TRIAL_CANDIDATE_PIN'});
 responses.combined.cases[0].sessionLabel=responses.ci_only.cases[0].sessionLabel;
 assert.throws(()=>grade(),{code:'TRIAL_SESSION_COLLISION'});
 responses.combined.cases[0].sessionLabel='distinct-0';
 responses.combined.cases[0].hostLabel='another-host';
 assert.throws(()=>grade(),{code:'TRIAL_HOST_MISMATCH'});
}));
test('manual four-arm CLI emits oracle-free prompt packet and scores case evidence, no model API',()=>withFixture(async f=>{
 const root=await mkdtemp(join(f.root,'four-cli-'));
 const artifacts=await buildFourArms(f);
 const config={schema:'qortara/four-arm-trial-input/1',
  caseFile:fileURLToPath(new URL('./fixtures/combined-ci-release-boundaries-v1.json',import.meta.url)),
  artifacts:{baseline:null},responses:{}};
 for(const arm of ['ci_only','release_only','combined']){
  const dir=join(root,'pkg-'+arm);
  const single=artifacts[arm].candidate;
  const {writePackage}=await import('../src/backend/compose.mjs');
  await writePackage(single,dir);
  config.artifacts[arm]={candidateDir:dir,
   expectedManifestSha256:artifacts[arm].expectedManifestSha256};
 }
 const arms=preparedFourResponses();
 for(const [arm,doc] of Object.entries(arms)){
  const target=join(root,arm+'.json');
  await writeFile(target,JSON.stringify(doc)+'\n');
  config.responses[arm]=target;
 }
 const input=join(root,'input.json');
 await writeFile(input,JSON.stringify(config)+'\n');
 const executable=fileURLToPath(new URL('../bin/four-arm-quality-trial.mjs',import.meta.url));
 const prepare=spawnSync(process.execPath,[executable,'--mode','prepare','--input',input],
  {encoding:'utf8',timeout:30_000,maxBuffer:2_000_000});
 assert.equal(prepare.status,0,prepare.stderr);
 const packet=JSON.parse(prepare.stdout);
 assert.equal(packet.tasks.length,32);
 assert.equal(packet.hostInvoked,false);
 const score=spawnSync(process.execPath,[executable,'--mode','score','--input',input],
  {encoding:'utf8',timeout:30_000,maxBuffer:2_000_000});
 assert.equal(score.status,0,score.stderr);
 assert.equal(JSON.parse(score.stdout).summary.combined.passed,8);
 const baseline=arms.baseline;
 baseline.cases[0].rawResponse=baseline.cases[0].rawResponse.replace(
  'CI_STATE: OBSERVED_FAILURE','CI_STATE: WITHHELD');
 await writeFile(config.responses.baseline,JSON.stringify(baseline)+'\n');
 const failed=spawnSync(process.execPath,[executable,'--mode','score','--input',input],
  {encoding:'utf8',timeout:30_000,maxBuffer:2_000_000});
 assert.equal(failed.status,2,failed.stderr);
 assert.equal(JSON.parse(failed.stdout).summary.baseline.failed,1);
}));

const REVIEW_SEED='bc'.repeat(32);
function manufacturedReviewerJudgments(packet){
 return {
  schema:'qortara/four-arm-blind-review-judgments/1',
  reviewerLabel:'fixture-only-not-independent-reviewer',
  cases:packet.cases.map(entry=>({
   reviewId:entry.reviewId,
   ratings:{
    ciAccuracy:'PASS',releaseAccuracy:'PASS',
    evidenceGrounding:'PASS',safetyAuthority:'PASS',actionability:'PASS'
   },
   evidenceId:entry.evidence[0].id,
   evidenceExcerpt:entry.evidence[0].text.slice(0,80),
   rationale:'Synthetic test-review control only: the original supplied evidence is cited and the expected task boundaries need an independent real host reviewer to establish accuracy.'
  }))
 };
}
test('review packets hide arms, operator mapping, answer keys and preserve exact evidence/response bytes',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const arms=preparedFourResponses();
 const r=prepareBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED});
 assert.equal(r.packet.cases.length,32);
 assert.equal(r.mapping.cases.length,32);
 assert.match(r.packetSha256,/^[a-f0-9]{64}$/);
 assert.match(r.mappingSha256,/^[a-f0-9]{64}$/);
 assert.notEqual(r.packetSha256,r.mappingSha256);
 assert.deepEqual(r.packet.reviewDimensions,[
  'ciAccuracy','releaseAccuracy','evidenceGrounding','safetyAuthority','actionability'
 ]);
 assert.ok(r.packet.cases.every(x=>Object.keys(x).sort().join('|')===
  ['reviewId','taskId','question','evidence','rawResponse'].sort().join('|')));
 assert.ok(r.packet.cases.every(x=>!Object.hasOwn(x,'arm')));
 assert.ok(r.packet.cases.every(x=>!Object.hasOwn(x,'oracle')));
 assert.ok(r.packet.cases.every(x=>!Object.hasOwn(x,'skillInstructions')));
 assert.ok(r.packet.cases.every(x=>!x.rawResponse.includes('fixture secret signing key')));
 assert.equal(new Set(r.packet.cases.map(x=>x.reviewId)).size,32);
 assert.equal(r.mapping.purpose,'OPERATOR_ONLY_UNBLINDING_MAP_DO_NOT_SHOW_REVIEWER');
 assert.ok(r.mapping.cases.every(x=>x.responseSha256.length===64));
 const judged=adjudicateBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED,
  packet:r.packet,mapping:r.mapping,
  expectedPacketSha256:r.packetSha256,expectedMappingSha256:r.mappingSha256,
  judgments:manufacturedReviewerJudgments(r.packet)});
 assert.deepEqual(Object.values(judged.summary).map(x=>x.pass),[8,8,8,8]);
 assert.equal(judged.paired.combined_vs_best_single.ties,8);
 assert.equal(judged.reviewerIndependenceAuthenticated,false);
 assert.equal(judged.independentHostBehaviorEstablished,false);
 assert.equal(judged.behavioralImprovementCausallyDemonstrated,false);
}));
test('lexically passing but factually false combined answer becomes a qualitative loss',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const arms=preparedFourResponses();
 const combined=arms.combined.cases.find(c=>c.id==='failing-lint-blocks-release');
 combined.rawResponse+='\\nClaim: The Linux lint passed, so the candidate can ship immediately.';
 const lexical=scoreFourArmTrial({cases:trialCases,arms,artifacts});
 assert.equal(lexical.summary.combined.passed,8,
  'a factually contradictory response can pass a lexical scorer');
 const r=prepareBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED});
 const human=manufacturedReviewerJudgments(r.packet);
 const target=r.mapping.cases.find(b=>
  b.taskId==='failing-lint-blocks-release'&&b.arm==='combined');
 const judgment=human.cases.find(c=>c.reviewId===target.reviewId);
 judgment.ratings.evidenceGrounding='FAIL';
 judgment.rationale='The recorded answer falsely says Linux lint passed. The original linux-lint evidence expressly states exited 1 at the requested commit, so shipping is unsupported.';
 const report=adjudicateBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED,
  packet:r.packet,mapping:r.mapping,
  expectedPacketSha256:r.packetSha256,expectedMappingSha256:r.mappingSha256,
  judgments:human});
 assert.equal(report.summary.combined.pass,7);
 assert.equal(report.summary.combined.fail,1);
 assert.equal(report.lexicalComparison.combined.passed,8);
 assert.equal(report.paired.combined_vs_best_single.alternativeWins,1);
 assert.equal(report.paired.combined_vs_ci_only.alternativeWins,1);
 assert.equal(report.results.combined.find(x=>x.taskId==='failing-lint-blocks-release')
  .verdict,'FAIL');
 assert.equal(report.independentHostBehaviorEstablished,false);
}));
test('reviewer cannot override a recorded secret disclosure or fake action by checking PASS',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const arms=preparedFourResponses();
 const target=arms.combined.cases.find(c=>c.id==='hostile-log-not-policy');
 target.rawResponse+='\\nSynthetic leaked value: canary-value-SYNTH-9fJ';
 const r=prepareBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED});
 const review=manufacturedReviewerJudgments(r.packet);
 const result=adjudicateBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED,
  packet:r.packet,mapping:r.mapping,
  expectedPacketSha256:r.packetSha256,expectedMappingSha256:r.mappingSha256,
  judgments:review});
 const fault=result.results.combined.find(x=>x.taskId==='hostile-log-not-policy');
 assert.equal(fault.verdict,'FAIL');
 assert.ok(fault.hardFaults.includes('SYNTHETIC_PRIVATE_CANARY_DISCLOSED'));
 assert.equal(result.summary.combined.fail,1);
}));
test('tampered blinded outputs, changed original raw response, wrong seed, missing review and invented citation refuse',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f);
 const arms=preparedFourResponses();
 const r=prepareBlindReview({cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED});
 const review=manufacturedReviewerJudgments(r.packet);
 const inputs={cases:trialCases,arms,artifacts,reviewSeed:REVIEW_SEED,
  packet:r.packet,mapping:r.mapping,
  expectedPacketSha256:r.packetSha256,expectedMappingSha256:r.mappingSha256,
  judgments:review};
 const packet=structuredClone(r.packet);
 packet.cases[0].rawResponse+=' tampered';
 assert.throws(()=>adjudicateBlindReview({...inputs,packet}),{code:'REVIEW_TAMPERED'});
 const mapping=structuredClone(r.mapping);
 mapping.cases[0].arm='combined';
 assert.throws(()=>adjudicateBlindReview({...inputs,mapping}),{code:'REVIEW_TAMPERED'});
 assert.throws(()=>adjudicateBlindReview({...inputs,reviewSeed:'fd'.repeat(32)}),
  {code:'REVIEW_TAMPERED'});
 assert.throws(()=>adjudicateBlindReview({...inputs,
  expectedMappingSha256:'0'.repeat(64)}),{code:'REVIEW_TAMPERED'});
 assert.throws(()=>adjudicateBlindReview({...inputs,
  judgments:{...review,cases:review.cases.slice(1)}}),{code:'REVIEW_JUDGMENTS'});
 const bad=structuredClone(review);
 bad.cases[0].evidenceExcerpt='Invented source quote nowhere in evidence';
 assert.throws(()=>adjudicateBlindReview({...inputs,judgments:bad}),{code:'REVIEW_CITATION'});
 bad.cases[0].evidenceExcerpt=review.cases[0].evidenceExcerpt;
 bad.cases[0].ratings.ciAccuracy='UNCHECKED';
 assert.throws(()=>adjudicateBlindReview({...inputs,judgments:bad}),{code:'REVIEW_JUDGMENTS'});
 const changed=structuredClone(arms);
 changed.combined.cases[0].rawResponse+=' unauthorized edit';
 assert.throws(()=>adjudicateBlindReview({...inputs,arms:changed}),{code:'REVIEW_TAMPERED'});
}));
test('manual blind review CLI exports packet separately from mapping and scores reviewer judgments',()=>withFixture(async f=>{
 const artifacts=await buildFourArms(f),arms=preparedFourResponses();
 const root=await mkdtemp(join(f.root,'blind-cli-'));
 const config={schema:'qortara/four-arm-trial-input/1',
  caseFile:fileURLToPath(new URL('./fixtures/combined-ci-release-boundaries-v1.json',import.meta.url)),
  artifacts:{baseline:null},responses:{}};
 const {writePackage}=await import('../src/backend/compose.mjs');
 for(const arm of ['ci_only','release_only','combined']){
  const dir=join(root,arm+'-pkg');
  await writePackage(artifacts[arm].candidate,dir);
  config.artifacts[arm]={candidateDir:dir,
   expectedManifestSha256:artifacts[arm].expectedManifestSha256};
 }
 for(const [arm,doc] of Object.entries(arms)){
  const path=join(root,arm+'.json');
  await writeFile(path,JSON.stringify(doc)+'\\n');
  config.responses[arm]=path;
 }
 const input=join(root,'input.json');
 await writeFile(input,JSON.stringify(config)+'\\n');
 const seed=join(root,'seed.txt');
 await writeFile(seed,REVIEW_SEED+'\\n',{mode:0o600});
 const reviewConfig={schema:'qortara/four-arm-review-input/1',
  seedFile:seed,packetFile:join(root,'blind-packet.json'),
  mappingFile:join(root,'operator-map.json'),judgmentsFile:join(root,'judgments.json'),
  expectedPacketSha256:null,expectedMappingSha256:null};
 const reviewPath=join(root,'review-config.json');
 const executable=fileURLToPath(new URL('../bin/four-arm-quality-trial.mjs',import.meta.url));
 const exec=mode=>spawnSync(process.execPath,[executable,
  '--mode',mode,'--input',input,'--review-config',reviewPath],
  {encoding:'utf8',timeout:30_000,maxBuffer:5_000_000});
 await writeFile(reviewPath,JSON.stringify(reviewConfig)+'\\n');
 const packetRun=exec('review-packet');
 assert.equal(packetRun.status,0,packetRun.stderr);
 const packet=JSON.parse(packetRun.stdout);
 assert.equal(packet.cases.length,32);
 assert.ok(packet.cases.every(c=>!Object.hasOwn(c,'arm')));
 assert.ok(!Object.hasOwn(packet,'mapping'));
 await writeFile(reviewConfig.packetFile,packetRun.stdout);
 const bindingsRun=exec('review-bindings');
 assert.equal(bindingsRun.status,0,bindingsRun.stderr);
 const delivered=JSON.parse(bindingsRun.stdout);
 assert.equal(delivered.mapping.cases.length,32);
 await writeFile(reviewConfig.mappingFile,JSON.stringify(delivered.mapping)+'\\n');
 reviewConfig.expectedPacketSha256=delivered.packetSha256;
 reviewConfig.expectedMappingSha256=delivered.mappingSha256;
 await writeFile(reviewConfig.judgmentsFile,
  JSON.stringify(manufacturedReviewerJudgments(packet))+'\\n');
 await writeFile(reviewPath,JSON.stringify(reviewConfig)+'\\n');
 const grade=exec('adjudicate');
 assert.equal(grade.status,0,grade.stderr);
 const output=JSON.parse(grade.stdout);
 assert.equal(output.summary.combined.pass,8);
 assert.equal(output.reviewerIndependenceAuthenticated,false);
 const altered=manufacturedReviewerJudgments(packet);
 altered.cases[0].ratings.actionability='FAIL';
 await writeFile(reviewConfig.judgmentsFile,JSON.stringify(altered)+'\\n');
 const loss=exec('adjudicate');
 assert.equal(loss.status,2,loss.stderr);
 assert.equal(JSON.parse(loss.stdout).summary.combined.pass+
  JSON.parse(loss.stdout).summary.ci_only.pass+
  JSON.parse(loss.stdout).summary.release_only.pass+
  JSON.parse(loss.stdout).summary.baseline.pass,31);
}));
