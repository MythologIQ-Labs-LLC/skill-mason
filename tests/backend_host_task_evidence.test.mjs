/** Synthetic host-output evidence tests. No real agent-host runs or owner approval. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createComposer,verifyPackage,writePackage} from '../src/backend/compose.mjs';
import {loadFirstPartyPilots,recipeForPilot} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {captureHostTaskEvidence,verifyHostTaskEvidence,inspectHostTaskMatrix} from '../src/backend/host-task-evidence.mjs';
import {execute,parseArgs} from '../bin/host-task-evidence.mjs';

const bytes=x=>Buffer.from(x,'utf8');
const hash=x=>createHash('sha256').update(x).digest('hex');
const refusal=code=>({code});
const HOLO='a'.repeat(64);
const goodGuest=({requestHex,holoSha256})=>({
 schema:'qortara/local-eligibility-result/1',status:'GUEST_COMPLETED',
 application:'Qortara Skills Eligibility',requestHex,response:'eligible',
 responseHex:'656c696769626c65',engine:'prism-code@0.9.5',
 artifact:{sha256:holoSha256},productionEligible:false,exitCode:0
});
async function packageFor(id,{proof='2'}={}){
 const registry=await loadFirstPartyPilots();
 const {plan,methods}=createRecipeAdapter(registry)(recipeForPilot(id,registry));
 const binding='1'.repeat(64);
 const composer=createComposer({
  holoSha256:HOLO,runPrism:goodGuest,
  sourceApprovalBindings:{[id]:binding},
  assertMethod:async({subjectSha256})=>({
   issuer:'fixture-not-owner',subjectSha256,proofDigest:proof.repeat(64),
   sourceBindingSha256:binding,sourceAcceptanceProofSha256:'3'.repeat(64),
   evidence:true,rights:true,authority:true,coverage:true
  })
 });
 return composer(plan,methods);
}
const metadata=(provider,sessionId)=>({
 provider,model:'test-reported-model',sessionId,observedAt:'2026-11-18T23:00:00Z'
});
function materials(id,polarity){
 return {
  prompt:bytes('Use the supplied evidence to review '+id+' without tools or false passing claims.'),
  reference:polarity==='negative'?Buffer.alloc(0):bytes(
   id==='ci-failure-triage'?
   'CI job=test step=typecheck failed with TS2304 at src/file.ts:9; exit 1.':
   'policy revision=abc123 requires native Qortara, implementation has supplemental docs check only.'),
  response:bytes(polarity==='negative'?
   'NOT_ESTABLISHED: required input evidence is absent. Request original source.':
   'Observed facts are bounded to the supplied reference; verification has not run.')
 };
}
function caseInput(pkg,id,polarity,provider,session){
 const data=materials(id,polarity),trustedManifestSha256=verifyPackage(pkg).packageSha256;
 const record=captureHostTaskEvidence({
  packageValue:pkg,trustedManifestSha256,host:metadata(provider,session),
  polarity,...data
 });
 return {record,packageValue:pkg,trustedManifestSha256,...data};
}
test('original pinned CI candidate creates digest-only, explicitly untrusted host evidence',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','positive','chatgpt','chatgpt-001');
 assert.equal(c.record.scenario.skillId,'ci-failure-triage');
 assert.equal(c.record.state,'CAPTURED_UNATTESTED');
 assert.equal(c.record.materials.prompt.sha256,hash(c.prompt));
 assert.equal(c.record.materials.response.byteLength,c.response.length);
 assert.equal(c.record.materials.reference.byteLength,c.reference.length);
 assert.equal(JSON.stringify(c.record).includes('TS2304'),false,'must not leak transcript body');
 const v=verifyHostTaskEvidence(c);
 assert.equal(v.rawTranscriptBytesMatched,true);
 assert.equal(v.state,'CAPTURE_HASHES_MATCH_UNATTESTED');
 assert.equal(v.behavioralOutcome,'NOT_ADJUDICATED');
 assert.equal(v.independentObserverAttested,false);
 assert.equal(v.hostOriginCryptographicallyVerified,false);
 assert.equal(v.sourceRightsEstablished,false);
 assert.equal(v.productionEligible,false);
 assert.equal(v.hostValidated,false);
});
test('governance source candidate is separate and stays unqualified',async()=>{
 const pkg=await packageFor('governance-drift-review');
 const c=caseInput(pkg,'governance-drift-review','positive','claude','claude-001');
 assert.equal(c.record.candidate.skillId,'governance-drift-review');
 assert.equal(c.record.materials.reference.sha256,hash(c.reference));
 assert.equal(verifyHostTaskEvidence(c).hostValidated,false);
});
test('changed raw response bytes refuse even when self-reported metadata matches',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','positive','chatgpt','session-3');
 await assert.throws(()=>verifyHostTaskEvidence({
  ...c,response:bytes('A different, substituted assistant response!')
 }),refusal('RECORD_TAMPERED'));
});
test('falsely promoting hostValidated or sourceRightsEstablished fails record verification',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','positive','chatgpt','session-4');
 for(const field of ['hostValidated','sourceRightsEstablished','independentObserverAttested']){
  const modified=JSON.parse(JSON.stringify(c.record));modified[field]=true;
  assert.throws(()=>verifyHostTaskEvidence({...c,record:modified}),
   refusal('RECORD_TAMPERED'));
 }
});
test('candidate must match original independently supplied manifest pin',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const data=materials('ci-failure-triage','positive');
 assert.throws(()=>captureHostTaskEvidence({
  packageValue:pkg,trustedManifestSha256:'f'.repeat(64),
  host:metadata('chatgpt','session-5'),polarity:'positive',...data
 }),refusal('CANDIDATE_CHANGED'));
 assert.throws(()=>captureHostTaskEvidence({
  packageValue:pkg,trustedManifestSha256:undefined,
  host:metadata('chatgpt','session-5'),polarity:'positive',...data
 }),refusal('EXTERNAL_PACKAGE_PIN'));
});
test('strict original-source method and source approval receipt required',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','positive','chatgpt','session-6');
 const altered=structuredClone(pkg);
 const source=JSON.parse(altered.files['SOURCES.json']);
 source.methods[0].id='fake-masquerading-as-original';
 altered.files['SOURCES.json']=JSON.stringify(source)+'\n';
 assert.throws(()=>captureHostTaskEvidence({
  ...c,packageValue:altered
 }),refusal('PACKAGE_INTEGRITY'));
});
test('positive scenario cannot omit referenced task evidence',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 assert.throws(()=>captureHostTaskEvidence({
  packageValue:pkg,trustedManifestSha256:verifyPackage(pkg).packageSha256,
  host:metadata('chatgpt','session-7'),polarity:'positive',
  ...materials('ci-failure-triage','positive'),reference:Buffer.alloc(0)
 }),refusal('EVIDENCE_BYTES'));
});
test('negative scenario can document missing reference without a fabricated input',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','negative','chatgpt','session-8');
 assert.equal(c.record.materials.reference.byteLength,0);
 assert.equal(verifyHostTaskEvidence(c).hostValidated,false);
});
test('untrusted providers, session labels and invalid UTF-8 refuse',async()=>{
 const pkg=await packageFor('ci-failure-triage');
 const c=caseInput(pkg,'ci-failure-triage','positive','chatgpt','session-9');
 assert.throws(()=>captureHostTaskEvidence({
  ...c,host:metadata('fixture-host','session-9')
 }),refusal('HOST_IDENTITY'));
 assert.throws(()=>captureHostTaskEvidence({
  ...c,host:metadata('chatgpt','session\n9')
 }),refusal('HOST_IDENTITY'));
 assert.throws(()=>captureHostTaskEvidence({
  ...c,host:metadata('chatgpt','session-9'),
  response:Buffer.from([0xff,0xfe])
 }),refusal('EVIDENCE_BYTES'));
});
test('four captures cover both hosts and both positive/negative controls but never self-certify',async()=>{
 const ci=await packageFor('ci-failure-triage');
 const gov=await packageFor('governance-drift-review');
 const cases=[
  caseInput(ci,'ci-failure-triage','positive','chatgpt','ci-plus'),
  caseInput(ci,'ci-failure-triage','negative','chatgpt','ci-minus'),
  caseInput(gov,'governance-drift-review','positive','claude','gov-plus'),
  caseInput(gov,'governance-drift-review','negative','claude','gov-minus')
 ];
 const matrix=inspectHostTaskMatrix(cases);
 assert.equal(matrix.state,'CAPTURE_MATRIX_COMPLETE_AWAITING_INDEPENDENT_REVIEW');
 assert.equal(matrix.captures.length,4);
 assert.equal(matrix.hostOriginCryptographicallyVerified,false);
 assert.equal(matrix.behavioralOutcome,'NOT_ADJUDICATED');
 assert.equal(matrix.hostValidated,false);
 assert.equal(matrix.productionEligible,false);
 assert.equal(matrix.sourceRightsEstablished,false);
});
test('matrix denies missing/duplicate scenario and same host-provider claim',async()=>{
 const ci=await packageFor('ci-failure-triage');
 const gov=await packageFor('governance-drift-review');
 const cases=[
  caseInput(ci,'ci-failure-triage','positive','chatgpt','a'),
  caseInput(ci,'ci-failure-triage','negative','chatgpt','b'),
  caseInput(gov,'governance-drift-review','positive','claude','c'),
  caseInput(gov,'governance-drift-review','negative','claude','d')
 ];
 assert.throws(()=>inspectHostTaskMatrix(cases.slice(0,3)),refusal('MATRIX_INCOMPLETE'));
 assert.throws(()=>inspectHostTaskMatrix([cases[0],cases[0],cases[2],cases[3]]),
  refusal('MATRIX_INCOMPLETE'));
 const sameHost=caseInput(gov,'governance-drift-review','negative','chatgpt','d');
 assert.throws(()=>inspectHostTaskMatrix([cases[0],cases[1],cases[2],sameHost]),
  refusal('MATRIX_SCOPE'));
 const otherHost=[
  cases[0],cases[1],
  caseInput(gov,'governance-drift-review','positive','chatgpt','c'),
  caseInput(gov,'governance-drift-review','negative','chatgpt','d')
 ];
 assert.throws(()=>inspectHostTaskMatrix(otherHost),refusal('MATRIX_SCOPE'));
});
test('matrix refuses reused host session labels and mixed candidate hashes',async()=>{
 const ci=await packageFor('ci-failure-triage');
 const gov=await packageFor('governance-drift-review');
 const cases=[
  caseInput(ci,'ci-failure-triage','positive','chatgpt','reused'),
  caseInput(ci,'ci-failure-triage','negative','chatgpt','reused'),
  caseInput(gov,'governance-drift-review','positive','claude','one'),
  caseInput(gov,'governance-drift-review','negative','claude','two')
 ];
 assert.throws(()=>inspectHostTaskMatrix(cases),refusal('MATRIX_DUPLICATE'));
 const alternateCi=await packageFor('ci-failure-triage',{proof:'4'});
 const shifted=[
  cases[0],caseInput(alternateCi,'ci-failure-triage','negative','chatgpt','unique'),
  cases[2],cases[3]
 ];
 assert.throws(()=>inspectHostTaskMatrix(shifted),refusal('MATRIX_SCOPE'));
});
test('operator CLI parses only exact required capture/verify arguments',()=>{
 assert.throws(()=>parseArgs(['capture']),refusal('USAGE'));
 assert.throws(()=>parseArgs(['verify','--unknown','x']),refusal('USAGE'));
 assert.throws(()=>parseArgs(['capture','--candidate-dir','a','--candidate-dir','b']),
  refusal('USAGE'));
});
test('operator CLI captures from sealed candidate and verifies raw local evidence offline',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-host-evidence-'));
 try{
  const pkg=await packageFor('ci-failure-triage'),manifest=verifyPackage(pkg).packageSha256;
  const dest=join(root,'ci-failure-triage');
  await writePackage(pkg,dest);
  const data=materials('ci-failure-triage','positive');
  const paths={prompt:join(root,'prompt.txt'),reference:join(root,'reference.txt'),
   response:join(root,'response.txt'),record:join(root,'evidence.json')};
  await Promise.all(['prompt','reference','response'].map(k=>writeFile(paths[k],data[k])));
  const shared=['--candidate-dir',dest,'--expected-package-sha256',manifest,
   '--prompt',paths.prompt,'--reference',paths.reference,'--response',paths.response];
  const result=await execute(['capture',...shared,'--host','chatgpt',
   '--model','operator-reported','--session','manual-session-1',
   '--observed-at','2026-11-18T23:00:00Z','--polarity','positive','--out',paths.record]);
  assert.equal(result.hostValidated,false);
  assert.equal(JSON.parse(await readFile(paths.record,'utf8')).sourceRightsEstablished,false);
  assert.equal((await execute(['verify',...shared,'--record',paths.record]))
   .state,'CAPTURE_HASHES_MATCH_UNATTESTED');
  await assert.rejects(execute(['capture',...shared,'--host','chatgpt',
   '--model','operator-reported','--session','manual-session-1',
   '--observed-at','2026-11-18T23:00:00Z','--polarity','positive','--out',paths.record]),
   {code:'EEXIST'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('CLI refuses symlinked source transcript files and no remote execution occurs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-host-symlink-'));
 try{
  const pkg=await packageFor('ci-failure-triage'),manifest=verifyPackage(pkg).packageSha256;
  const dest=join(root,'ci-failure-triage');await writePackage(pkg,dest);
  const data=materials('ci-failure-triage','positive');
  const raw=join(root,'prompt.txt'),link=join(root,'linked-prompt.txt');
  await writeFile(raw,data.prompt);await symlink(raw,link);
  await writeFile(join(root,'reference.txt'),data.reference);
  await writeFile(join(root,'response.txt'),data.response);
  await assert.rejects(execute([
   'capture','--candidate-dir',dest,'--expected-package-sha256',manifest,
   '--prompt',link,'--reference',join(root,'reference.txt'),
   '--response',join(root,'response.txt'),'--host','chatgpt','--model','model',
   '--session','s','--observed-at','2026-11-18T23:00:00Z',
   '--polarity','positive','--out',join(root,'record.json')
  ]),refusal('EVIDENCE_PATH'));
 }finally{await rm(root,{recursive:true,force:true});}
});
