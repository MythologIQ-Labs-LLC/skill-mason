/** Host-pair intake behavioral contract; fixture observations are NOT host runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createComposer,verifyPackage,writePackage} from '../src/backend/compose.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,
  PILOT_RELEASE_V2_SOURCE_COMMIT,PILOT_RELEASE_SOURCE_COMMIT,
  PILOT_V5_SOURCE_COMMIT,PILOT_SOURCE_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {captureHostTaskEvidence,verifyHostTaskEvidence,inspectHostTaskPair,
  HOST_PAIR_SCHEMA} from '../src/backend/host-task-evidence.mjs';
import {execute,parseArgs} from '../bin/host-task-evidence.mjs';

const PIN='a'.repeat(64);
const bytes=x=>Buffer.from(x,'utf8');
const error=code=>({code});
function ready({requestHex,holoSha256}){return {schema:'qortara/local-eligibility-result/1',
 status:'GUEST_COMPLETED',application:'Qortara Skills Eligibility',
 requestHex,response:'eligible',responseHex:'656c696769626c65',
 engine:'prism-code@0.9.5',artifact:{sha256:holoSha256},productionEligible:false,exitCode:0};}
async function makeCandidate(id,{nonce='b'}={}){
 const registry=await loadFirstPartyPilots();
 const {plan,methods}=createRecipeAdapter(registry)(recipeForPilot(id,registry));
 const signer=createComposer({
  holoSha256:PIN,runPrism:ready,
  sourceApprovalBindings:{[id]:'1'.repeat(64)},
  assertMethod:async({subjectSha256})=>({
   issuer:'fixture-only-not-real-approval',subjectSha256,
   proofDigest:nonce.repeat(64),
   sourceBindingSha256:'1'.repeat(64),
   sourceAcceptanceProofSha256:'2'.repeat(64),
   evidence:true,rights:true,authority:true,coverage:true})
 });
 const pkg=await signer(plan,methods);
 assert.equal(pkg.status,'DEVELOPMENT_CANDIDATE');
 return pkg;
}
const prompt=bytes('Please inspect the scoped release evidence against accepted owner gates. Do not publish, sign, install, access secrets or invent any missing checks.');
const reference=bytes('Synthetic policy rev P7: exact commit ffffffffffffffffffffffffffffffffffffffff; required gates Linux and Windows signing. Linux green. Windows signing failed. No artifact signoff granted.');
const missing=Buffer.alloc(0);
const response=bytes('HOLD: Linux passed at the requested revision; mandatory Windows signing failed. Owner must repair and witness an exact-head signature verification. Not published.');
const refusal=bytes('EVIDENCE_INCOMPLETE: No release policy or version-bound gate receipts provided. The report withholds readiness and does not publish or sign.');
const host=(id,provider='chatgpt',model='fixture-model')=>({
 provider,model,sessionId:id,observedAt:'2026-11-20T08:00:00Z'});
function makeCase(pkg,id,polarity,provider='chatgpt',session=polarity,model='fixture-model'){
 const input={packageValue:pkg,trustedManifestSha256:verifyPackage(pkg).packageSha256,
  host:host(session,provider,model),polarity,prompt,
  reference:polarity==='positive'?reference:missing,
  response:polarity==='positive'?response:refusal};
 return {...input,record:captureHostTaskEvidence(input)};
}
test('all eight historical original source commits enter strict unqualified host capture',async()=>{
 const expected={
  'ci-failure-triage':PILOT_SOURCE_COMMIT,
  'ci-failure-triage-v5':PILOT_V5_SOURCE_COMMIT,
  'release-readiness-review':PILOT_RELEASE_SOURCE_COMMIT,
  'release-readiness-review-v2':PILOT_RELEASE_V2_SOURCE_COMMIT
 };
 for(const def of PILOT_DEFINITIONS){
  const pkg=await makeCandidate(def.id);
  const input=makeCase(pkg,def.id,'positive','chatgpt',def.id);
  assert.equal(input.record.candidate.originalSourceCommit,
   expected[def.id]??def.sourceCommit??PILOT_SOURCE_COMMIT);
  assert.equal(input.record.candidate.originalMethodSha256,def.sha256);
  assert.equal(input.record.candidate.skillId,def.id);
  assert.equal(input.record.sourceRightsEstablished,false);
  assert.equal(input.record.hostValidated,false);
  assert.equal(verifyHostTaskEvidence(input).rawTranscriptBytesMatched,true);
 }
 assert.equal(PILOT_DEFINITIONS.length,8);
});
test('new release readiness v2 skill supports a complete two-control intake without inventing host success',async()=>{
 const pkg=await makeCandidate('release-readiness-review-v2');
 const positive=makeCase(pkg,'release-readiness-review-v2','positive','chatgpt','host-real-case-positive');
 const negative=makeCase(pkg,'release-readiness-review-v2','negative','chatgpt','host-real-case-negative');
 const result=inspectHostTaskPair([positive,negative]);
 assert.equal(result.schema,HOST_PAIR_SCHEMA);
 assert.equal(result.state,'CAPTURE_PAIR_COMPLETE_AWAITING_INDEPENDENT_REVIEW');
 assert.equal(result.skillId,'release-readiness-review-v2');
 assert.equal(result.captures.length,2);
 assert.deepEqual(result.captures.map(c=>c.polarity),['negative','positive']);
 assert.equal(result.manifestSha256,verifyPackage(pkg).packageSha256);
 for(const key of ['independentObserverAttested','hostOriginCryptographicallyVerified',
   'sourceRightsEstablished','productionEligible','hostValidated'])
  assert.equal(result[key],false,key+' must remain unqualified');
 assert.equal(result.behavioralOutcome,'NOT_ADJUDICATED');
 assert.equal(result.reportedHostProvider,'chatgpt');
 assert.equal(result.reportedHostModel,'fixture-model');
});
test('per-method pair works with historical original, not just newest release method',async()=>{
 const pkg=await makeCandidate('ci-failure-triage');
 const cases=[makeCase(pkg,'ci-failure-triage','positive','claude','one'),
  makeCase(pkg,'ci-failure-triage','negative','claude','two')];
 assert.equal(inspectHostTaskPair(cases).skillId,'ci-failure-triage');
});
test('pair requires positive AND negative, cannot substitute duplicate control',async()=>{
 const pkg=await makeCandidate('release-readiness-review-v2');
 const p=makeCase(pkg,'release-readiness-review-v2','positive','chatgpt','first');
 const n=makeCase(pkg,'release-readiness-review-v2','negative','chatgpt','second');
 assert.throws(()=>inspectHostTaskPair([p]),error('PAIR_INCOMPLETE'));
 assert.throws(()=>inspectHostTaskPair([p,p]),error('PAIR_INCOMPLETE'));
 assert.throws(()=>inspectHostTaskPair([n,n]),error('PAIR_INCOMPLETE'));
});
test('pair refuses mixed versions, source identity or different sealed candidate receipts',async()=>{
 const newer=await makeCandidate('release-readiness-review-v2');
 const older=await makeCandidate('release-readiness-review');
 const p=makeCase(newer,'release-readiness-review-v2','positive','chatgpt','one');
 const mixed=makeCase(older,'release-readiness-review','negative','chatgpt','two');
 assert.throws(()=>inspectHostTaskPair([p,mixed]),error('PAIR_INCOMPLETE'));
 const different=await makeCandidate('release-readiness-review-v2',{nonce:'e'});
 const n=makeCase(different,'release-readiness-review-v2','negative','chatgpt','two');
 assert.throws(()=>inspectHostTaskPair([p,n]),error('PAIR_SCOPE'));
});
test('pair refuses different host providers, model labels or reused session identifiers',async()=>{
 const pkg=await makeCandidate('release-readiness-review-v2');
 const p=makeCase(pkg,'release-readiness-review-v2','positive','chatgpt','one');
 const n=makeCase(pkg,'release-readiness-review-v2','negative','chatgpt','two');
 assert.throws(()=>inspectHostTaskPair([p,makeCase(pkg,
  'release-readiness-review-v2','negative','claude','two')]),error('PAIR_SCOPE'));
 assert.throws(()=>inspectHostTaskPair([p,makeCase(pkg,
  'release-readiness-review-v2','negative','chatgpt','two','different-model')]),
  error('PAIR_SCOPE'));
 assert.throws(()=>inspectHostTaskPair([p,makeCase(pkg,
  'release-readiness-review-v2','negative','chatgpt','one')]),error('PAIR_DUPLICATE'));
 assert.equal(inspectHostTaskPair([p,n]).captures.length,2);
});
test('pair refuses forged host approval and tampered transcript even if case count is intact',async()=>{
 const pkg=await makeCandidate('release-readiness-review-v2');
 const p=makeCase(pkg,'release-readiness-review-v2','positive','chatgpt','one');
 const n=makeCase(pkg,'release-readiness-review-v2','negative','chatgpt','two');
 assert.throws(()=>inspectHostTaskPair([{...p,
  record:{...p.record,hostValidated:true}},n]),error('RECORD_TAMPERED'));
 assert.throws(()=>inspectHostTaskPair([{...p,
  response:bytes('Fabricated full success without an actual model run.')},n]),error('RECORD_TAMPERED'));
 assert.throws(()=>inspectHostTaskPair([{...p,
  trustedManifestSha256:'f'.repeat(64)},n]),error('CANDIDATE_CHANGED'));
});
test('CLI pair consumes actual sealed disk files, outputs one digest-only record and refuses overwrite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-host-pair-'));
 try{
  const pkg=await makeCandidate('release-readiness-review-v2');
  const candidateDir=join(root,'release-readiness-review-v2');
  await writePackage(pkg,candidateDir);
  const expectedPackageSha256=verifyPackage(pkg).packageSha256;
  const entries=[];
  for(const polarity of ['positive','negative']){
   const dir=join(root,polarity);
   const p=join(root,polarity+'-prompt.txt'),
    ref=join(root,polarity+'-reference.txt'),
    res=join(root,polarity+'-response.txt'),
    rec=join(root,polarity+'-record.json');
   const data=polarity==='positive'?{prompt,reference,response}:
    {prompt,reference:missing,response:refusal};
   await Promise.all([writeFile(p,data.prompt),writeFile(ref,data.reference),
    writeFile(res,data.response)]);
   await execute(['capture','--candidate-dir',candidateDir,
    '--expected-package-sha256',expectedPackageSha256,'--prompt',p,
    '--reference',ref,'--response',res,
    '--host','codex','--model','fixture-model',
    '--session','synthetic-'+polarity,'--observed-at','2026-11-20T08:00:00Z',
    '--polarity',polarity,'--out',rec]);
   entries.push({candidateDir,expectedPackageSha256,prompt:p,reference:ref,
    response:res,record:rec});
  }
  const manifest=join(root,'two-cases.json'),out=join(root,'pair-report.json');
  await writeFile(manifest,JSON.stringify({
   schema:'qortara/operator-host-pair-input/1',cases:entries})+'\n');
  assert.equal(parseArgs(['pair','--manifest',manifest,'--out',out]).mode,'pair');
  const observed=await execute(['pair','--manifest',manifest,'--out',out]);
  assert.equal(observed.skillId,'release-readiness-review-v2');
  assert.equal(observed.reportedHostProvider,'codex');
  assert.equal(observed.hostOriginCryptographicallyVerified,false);
  assert.equal(observed.productionEligible,false);
  assert.equal(JSON.parse(await readFile(out,'utf8')).state,
   'CAPTURE_PAIR_COMPLETE_AWAITING_INDEPENDENT_REVIEW');
  await assert.rejects(execute(['pair','--manifest',manifest,'--out',out]),{code:'EEXIST'});
  await writeFile(entries[0].response,'an attacker replaced this original transcript');
  await assert.rejects(execute(['pair','--manifest',manifest,
   '--out',join(root,'forged.json')]),error('RECORD_TAMPERED'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('CLI pair refuses manifest that downgrades to historical four-case scheme',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-host-pair-bad-'));
 try{
  const manifest=join(root,'manifest.json');
  await writeFile(manifest,JSON.stringify({
   schema:'qortara/operator-host-matrix-input/1',cases:[]}));
  await assert.rejects(execute(['pair','--manifest',manifest,
   '--out',join(root,'result.json')]),error('PAIR_SCHEMA'));
  assert.throws(()=>parseArgs(['pair','--manifest','a','--model','b']),
   error('USAGE'));
 }finally{await rm(root,{recursive:true,force:true});}
});
