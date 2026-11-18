/** Exact proof-digest persistence; all positive methods here are synthetic P0 fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createComposer,verifyPackage,writePackage,readPackage} from '../src/backend/compose.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const holo='c'.repeat(64),sourceText='Read a test fixture and report the evidence.';
const method=()=>({id:'method-receipt-fixture',origin:'https://example.invalid/test-only',
 sourcePath:'docs/fixture.md',commit:'a'.repeat(40),sha256:sha(sourceText),
 methodVersion:'v1',methodText:sourceText,covers:['report tested evidence'],containsAssets:false});
const plan=()=>({schema:'qortara/internal-composition-plan/1',name:'source-proof-fixture',
 title:'Source proof fixture',description:'No actual source rights are established.',
 targetHost:'fixture-only',requiredOutcomes:['report tested evidence'],
 network:false,secrets:false,execution:false,
 sourceSnapshot:{repository:'https://example.invalid/test-only',
  commit:'a'.repeat(40),sha256:'d'.repeat(64)},
 packagePins:[{methodId:'method-receipt-fixture',packageId:'source-fixture',
  sha256:'e'.repeat(64)}]});
const approvalBinding='1'.repeat(64);
const approvalProof='2'.repeat(64);
const fourFactProof='3'.repeat(64);
const assertions=({subjectSha256})=>({
 subjectSha256,issuer:'fixture-signed-only',proofDigest:fourFactProof,
 sourceBindingSha256:approvalBinding,
 sourceAcceptanceProofSha256:approvalProof,
 evidence:true,rights:true,authority:true,coverage:true});
let calls;
const guest=({requestHex,holoSha256})=>{
 calls++;
 return {schema:'qortara/local-eligibility-result/1',status:'GUEST_COMPLETED',
  application:'Qortara Skills Eligibility',response:'eligible',
  responseHex:'656c696769626c65',requestHex,engine:'prism-code@0.9.5',
  artifact:{sha256:holoSha256},productionEligible:false,exitCode:0};
};
const strict=(cb=assertions,bindings={'method-receipt-fixture':approvalBinding})=>
 createComposer({assertMethod:cb,runPrism:guest,holoSha256:holo,
  sourceApprovalBindings:bindings});
const rejection=code=>({code});

test('operator-pinned source mode seals separate proof digests inside receipt',async()=>{
 calls=0;
 const pkg=await strict()(plan(),[method()]);
 assert.equal(calls,1);
 const r=JSON.parse(pkg.files['RECEIPT.json']);
 assert.equal(r.sourceApprovalRequired,true);
 assert.equal(r.sourceApprovalState,
  'PROOF_DIGESTS_RECORDED_SIGNATURES_REQUIRE_INDEPENDENT_REPLAY');
 assert.equal(r.assertions.length,1);
 assert.equal(r.assertions[0].sourceBindingSha256,approvalBinding);
 assert.equal(r.assertions[0].sourceAcceptanceProofSha256,approvalProof);
 assert.equal(r.assertions[0].proofDigest,fourFactProof);
 assert.match(r.assertions[0].subjectSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.productionEligible,false);
 const check=verifyPackage(pkg);
 assert.equal(check.sourceAcceptanceProofRecorded,true);
 assert.equal(check.sourceAcceptanceSignatureVerified,false);
 assert.equal(check.signedFourFactAssertionReverified,false);
 assert.equal(check.authorityVerified,false);
});
test('byte-identical signed approval fixtures yield deterministic four-file package',async()=>{
 const c=strict(),a=await c(plan(),[method()]),b=await c(plan(),[method()]);
 assert.deepEqual(a,b);
 assert.equal(a.status,'DEVELOPMENT_CANDIDATE');
});
test('source acceptance required refuses absent proof before any guest call',async()=>{
 calls=0;
 const cb=({subjectSha256})=>({...assertions({subjectSha256}),
  sourceAcceptanceProofSha256:undefined});
 await assert.rejects(strict(cb)(plan(),[method()]),rejection('SOURCE_ACCEPTANCE_REQUIRED'));
 assert.equal(calls,0);
});
test('source binding changed or replayed from another source cannot qualify',async()=>{
 calls=0;
 const cb=({subjectSha256})=>({...assertions({subjectSha256}),
  sourceBindingSha256:'f'.repeat(64)});
 await assert.rejects(strict(cb)(plan(),[method()]),rejection('SOURCE_ACCEPTANCE_REQUIRED'));
 assert.equal(calls,0);
});
test('partial proof fields in no-binding legacy mode refuse rather than being silently lost',async()=>{
 calls=0;
 const c=createComposer({assertMethod:assertions,runPrism:guest,holoSha256:holo});
 await assert.rejects(c(plan(),[method()]),rejection('SOURCE_ACCEPTANCE_CONFIG'));
 assert.equal(calls,0);
});
test('strict mode requires pinned snapshot and package in plan',async()=>{
 calls=0;
 const p=plan();delete p.sourceSnapshot;delete p.packagePins;
 await assert.rejects(strict()(p,[method()]),rejection('SOURCE_ACCEPTANCE_CONFIG'));
 assert.equal(calls,0);
});
test('strict mode refuses unconfigured method, extra method key and malformed pins',async()=>{
 calls=0;
 await assert.rejects(strict(assertions,{'other-method':'1'.repeat(64)})
  (plan(),[method()]),rejection('SOURCE_ACCEPTANCE_CONFIG'));
 await assert.rejects(strict(assertions,{
  'method-receipt-fixture':approvalBinding,'other-method':'3'.repeat(64)
 })(plan(),[method()]),rejection('SOURCE_ACCEPTANCE_CONFIG'));
 assert.throws(()=>strict(assertions,{'method-receipt-fixture':'bad'}),
  rejection('SOURCE_ACCEPTANCE_CONFIG'));
 assert.equal(calls,0);
});
test('source approval mode is pinned on coordinator, not mutable via recipe',async()=>{
 const p=plan();p.sourceApprovalRequired=false;
 await assert.rejects(strict()(p,[method()]),rejection('INVALID_RECIPE'));
});
test('sealed signed-source receipt survives complete exclusive disk write/read',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-signed-source-'));
 try{
  const pkg=await strict()(plan(),[method()]),dest=join(root,'output');
  await writePackage(pkg,dest);
  const replay=await readPackage(dest);
  assert.deepEqual(replay,pkg);
  assert.equal(verifyPackage(replay).sourceAcceptanceProofRecorded,true);
  assert.equal(verifyPackage(replay).sourceAcceptanceSignatureVerified,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('source approval digest corruption after seal is detected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-signed-source-'));
 try{
  const pkg=await strict()(plan(),[method()]),dest=join(root,'output');
  await writePackage(pkg,dest);
  const receipt=JSON.parse(await readFile(join(dest,'RECEIPT.json'),'utf8'));
  receipt.assertions[0].sourceAcceptanceProofSha256='f'.repeat(64);
  await writeFile(join(dest,'RECEIPT.json'),JSON.stringify(receipt)+'\n');
  await assert.rejects(readPackage(dest),rejection('PACKAGE_INTEGRITY'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('recrosshash cannot turn malformed partial approval ledger into a valid package',async()=>{
 const pkg=await strict()(plan(),[method()]);
 const r=JSON.parse(pkg.files['RECEIPT.json']);
 delete r.assertions[0].sourceAcceptanceProofSha256;
 pkg.files['RECEIPT.json']=JSON.stringify(r)+'\n';
 const manifest=JSON.parse(pkg.files['skill-mason.json']);
 manifest.receiptSha256=sha(pkg.files['RECEIPT.json']);
 pkg.files['skill-mason.json']=JSON.stringify(manifest)+'\n';
 assert.throws(()=>verifyPackage(pkg),rejection('PACKAGE_INTEGRITY'));
});
test('legacy fixture without source proof remains development-only and readable',async()=>{
 const cb=({subjectSha256})=>({issuer:'fixture',subjectSha256,
  proofDigest:fourFactProof,evidence:true,rights:true,authority:true,coverage:true});
 const p=await createComposer({assertMethod:cb,runPrism:guest,holoSha256:holo})
  (plan(),[method()]);
 const r=JSON.parse(p.files['RECEIPT.json']);
 assert.equal(r.sourceApprovalRequired,undefined);
 assert.equal(r.assertions[0].sourceAcceptanceProofSha256,undefined);
 assert.equal(verifyPackage(p).sourceAcceptanceProofRecorded,false);
 assert.equal(verifyPackage(p).productionQualified,false);
});
test('changed four-fact proof and source approval proof both influence receipt hash',async()=>{
 const a=await strict()(plan(),[method()]);
 const b=await strict(({subjectSha256})=>({...assertions({subjectSha256}),
  proofDigest:'f'.repeat(64)}))(plan(),[method()]);
 const c=await strict(({subjectSha256})=>({...assertions({subjectSha256}),
  sourceAcceptanceProofSha256:'f'.repeat(64)}))(plan(),[method()]);
 assert.notEqual(a.files['RECEIPT.json'],b.files['RECEIPT.json']);
 assert.notEqual(a.files['RECEIPT.json'],c.files['RECEIPT.json']);
 assert.notEqual(a.files['skill-mason.json'],b.files['skill-mason.json']);
 assert.notEqual(a.files['skill-mason.json'],c.files['skill-mason.json']);
});
