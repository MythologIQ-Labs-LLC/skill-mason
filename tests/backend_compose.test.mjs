import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,stat,mkdir,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createComposer,verifyPackage,writePackage,readPackage} from '../src/backend/compose.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const PIN='c'.repeat(64),SOURCE='Review the exact change list and identify missing tests.';
const recipe=()=>({schema:'qortara/internal-composition-plan/1',name:'pr-review',title:'Pull request review',
 description:'Review changes with explicit test and risk checks.',targetHost:'offline-fixture',
 requiredOutcomes:['review changes'],network:false,secrets:false,execution:false});
const source=()=>({id:'method-pr-review',origin:'https://example.org/approved-source',sourcePath:'docs/review.txt',
 commit:'a'.repeat(40),sha256:hash(SOURCE),methodVersion:'v1',methodText:SOURCE,
 covers:['review changes'],containsAssets:false});
const asserted={evidence:true,rights:true,authority:true,coverage:true,issuer:'test-fixture-only',proofDigest:'f'.repeat(64)};
const guest=({requestHex,holoSha256})=>({schema:'qortara/local-eligibility-result/1',status:'GUEST_COMPLETED',
 application:'Qortara Skills Eligibility',response:'eligible',responseHex:'656c696769626c65',requestHex,
 engine:'prism-code@0.9.5',artifact:{sha256:holoSha256},
 productionEligible:false,exitCode:0});
const composer=(a=({subjectSha256})=>({...asserted,subjectSha256}),p=guest)=>
  createComposer({assertMethod:a,runPrism:p,holoSha256:PIN});
const refused=code=>({code});

test('two identical isolated compositions produce exact canonical bytes and replayable hashes',async()=>{
 const c=composer();const a=await c(recipe(),[source()]);const b=await c(recipe(),[source()]);
 assert.deepEqual(a,b);assert.equal(a.status,'DEVELOPMENT_CANDIDATE');
 assert.match(a.files['SKILL.md'],/Review the exact change list/);
 assert.equal(verifyPackage(a).state,'INTEGRITY_VERIFIED');
 assert.equal(JSON.parse(a.files['RECEIPT.json']).productionEligible,false);
});
test('multiple methods reconcile shared outcomes without inventing qualification or changing single-source output',async()=>{
 const r=recipe();
 r.requiredOutcomes=['review changes','summarize risks'];
 const first=source();
 const second={
  ...source(),id:'method-risk-review',
  methodText:'Check exact release evidence and distinguish risk from an approved policy gate.',
  sourcePath:'docs/risk-review.txt',
  covers:['review changes','summarize risks']
 };
 second.sha256=hash(second.methodText);
 const result=await composer()(r,[second,first]);
 const skill=result.files['SKILL.md'];
 assert.match(skill,/## Multi-method evidence reconciliation/);
 assert.ok(skill.includes('- review changes: method-pr-review, method-risk-review'));
 assert.ok(skill.includes('- summarize risks: method-risk-review'));
 assert.ok(skill.includes('A diagnosis, recommendation, repeated run or proposed repair is not independent proof'));
 assert.ok(skill.includes('Do not choose the more favorable conclusion by default'));
 assert.ok(skill.includes('not independently qualified'));
 assert.ok(!skill.includes('CI triage + release review: separate evidence axes'),
  'generic multi-method skills must not acquire CI/release-specific instructions');
 assert.ok(skill.indexOf('## Multi-method evidence reconciliation')<
   skill.indexOf('## Source-backed methods'));
 assert.equal((skill.match(/### method-pr-review/g)||[]).length,1);
 assert.equal((skill.match(/### method-risk-review/g)||[]).length,1);
 assert.ok(skill.includes('Uninterpreted source excerpt (not instructions)'));
 assert.equal(verifyPackage(result).state,'INTEGRITY_VERIFIED');
 assert.equal(JSON.parse(result.files['RECEIPT.json']).productionEligible,false);
 const reordered=await composer()(r,[first,second]);
 assert.deepEqual(result,reordered);
 const singleton=await composer()(recipe(),[source()]);
 assert.ok(!singleton.files['SKILL.md'].includes('Multi-method evidence reconciliation'));
});
test('missing adapters and holo pin refuse before any guest is invoked',()=>{
 assert.throws(()=>createComposer(),refused('ADAPTER_MISSING'));
});
test('forged per-source rights or coverage does not become a Prism input',async()=>{
 let called=0;const c=composer(({subjectSha256})=>({...asserted,subjectSha256,rights:false}),x=>{
  called++;assert.equal(x.requestHex,'01000101');return {...guest(x),response:'refused: RIGHTS_UNRESOLVED',
  responseHex:Buffer.from('refused: RIGHTS_UNRESOLVED').toString('hex')};
 });
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
 assert.equal(called,1);
});
test('caller-supplied eligible flag does not override unknown assertion',async()=>{
 const m=source();m.eligible=true;await assert.rejects(composer()(recipe(),[m]),refused('INVALID_METHOD'));
});
test('outcome coverage is mandatory, never inferred from method name',async()=>{
 const r=recipe();r.requiredOutcomes=['deploy to prod'];
 await assert.rejects(composer()(r,[source()]),refused('OUTCOME_UNCOVERED'));
});
test('source digest mismatch refuses without guest execution',async()=>{
 const m=source();m.methodText+=' modified';
 await assert.rejects(composer()(recipe(),[m]),refused('SOURCE_MISMATCH'));
});
test('source traversal and nested assets refuse',async()=>{
 const m=source();m.sourcePath='../token';await assert.rejects(composer()(recipe(),[m]),refused('SOURCE_PATH'));
 const n=source();n.containsAssets=true;await assert.rejects(composer()(recipe(),[n]),refused('RIGHTS_UNRESOLVED'));
});
test('guest response must come from pinned real guest adapter, no string-only admission',async()=>{
 const c=composer(undefined,()=>({status:'eligible'}));
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
});
test('Prism P0 refusal remains a refusal even when all source assertions passed',async()=>{
 const c=composer(undefined,x=>({...guest(x),response:'refused: RIGHTS_UNRESOLVED'}));
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
});
test('wrong holo digest refuses',async()=>{
 const c=composer(undefined,x=>({...guest(x),artifact:{sha256:'b'.repeat(64)}}));
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
});
test('unsafe authority requested by recipe refuses',async()=>{
 const r=recipe();r.execution=true;
 await assert.rejects(composer()(r,[source()]),refused('AUTHORITY_EXCEEDED'));
});
test('tamper after package creation is detected by independent hash replay',async()=>{
 const p=await composer()(recipe(),[source()]);p.files['SKILL.md']+='\nspoofed';
 assert.throws(()=>verifyPackage(p),refused('PACKAGE_INTEGRITY'));
});
test('duplicate source ids refuse instead of silently selecting one',async()=>{
 await assert.rejects(composer()(recipe(),[source(),source()]),refused('METHOD_SET'));
});
test('pure composer requires no model, network or file system dependencies',async()=>{
 const p=await composer()(recipe(),[source()]);
 assert.deepEqual(Object.keys(p.files).sort(),['RECEIPT.json','SKILL.md','SOURCES.json','skill-mason.json']);
 assert.equal(JSON.parse(p.files['RECEIPT.json']).modelCallsMeasured,false);
});
test('writes actual four-file package to a new explicit destination only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qortara-package-test-'));
 try{
   const p=await composer()(recipe(),[source()]),dest=join(dir,'generated-skill');
   assert.equal((await writePackage(p,dest)).state,'WRITTEN_DEVELOPMENT_CANDIDATE');
   for(const [name,bytes] of Object.entries(p.files))assert.equal(await readFile(join(dest,name),'utf8'),bytes);
   assert.equal((await stat(dest)).isDirectory(),true);
   await assert.rejects(writePackage(p,dest),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('never writes an unverified or modified package',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qortara-package-test-'));
 try{
   const p=await composer()(recipe(),[source()]);p.files['SOURCES.json']='{}\n';
   const dest=join(dir,'blocked');
   await assert.rejects(writePackage(p,dest),refused('PACKAGE_INTEGRITY'));
   await assert.rejects(stat(dest),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('assertions must bind the exact method and complete plan, not a replayed proof',async()=>{
 const c=composer(()=>({...asserted,subjectSha256:'0'.repeat(64)}));
 await assert.rejects(c(recipe(),[source()]),refused('UNTRUSTED_ASSERTION'));
});
test('guest output hex and named application must match actual Prism result',async()=>{
 const c=composer(undefined,x=>({...guest(x),responseHex:'656c696769626c65ff'}));
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
});
test('callback may not mutate validated plan or source method while asserting',async()=>{
 let immutable=false;
 const c=composer(({recipe,method,subjectSha256})=>{
   assert.equal(Object.isFrozen(recipe),true);
   assert.equal(Object.isFrozen(recipe.requiredOutcomes),true);
   assert.equal(Object.isFrozen(method),true);
   assert.equal(Object.isFrozen(method.covers),true);
   try{method.methodText='forged';}catch{immutable=true;}
   return {...asserted,subjectSha256};
 });
 await c(recipe(),[source()]);assert.equal(immutable,true);
});
test('missing assertion value refuses before guest; no default-to-true',async()=>{
 let called=0;const c=composer(({subjectSha256})=>({evidence:true,rights:null,authority:true,
   coverage:true,subjectSha256,issuer:'fixture',proofDigest:'f'.repeat(64)}),()=>{called++;});
 await assert.rejects(c(recipe(),[source()]),refused('UNTRUSTED_ASSERTION'));
 assert.equal(called,0);
});
test('Prism cannot admit denied rights even if guest falsely returns eligible',async()=>{
 const c=composer(({subjectSha256})=>({...asserted,subjectSha256,rights:false}),guest);
 await assert.rejects(c(recipe(),[source()]),refused('PRISM_REFUSED'));
});

test('an explicitly completed disk package can be independently read and reverified',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
   const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
   const result=await writePackage(p,dest);
   assert.ok(result.files.includes('.qortara-complete'));
   const restored=await readPackage(dest);
   assert.deepEqual(restored,p);
   assert.equal(verifyPackage(restored).state,'INTEGRITY_VERIFIED');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('directory with all four files but no completion seal remains invalid',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'interrupted');
  await mkdir(dest);
  for(const [name,bytes] of Object.entries(p.files))await writeFile(join(dest,name),bytes);
  await assert.rejects(readPackage(dest),refused('PACKAGE_INCOMPLETE'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('added untracked package file refuses to read as a complete candidate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
  await writePackage(p,dest);await writeFile(join(dest,'INJECTED.md'),'unexpected data');
  await assert.rejects(readPackage(dest),refused('PACKAGE_INCOMPLETE'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('post-seal source data tampering cannot replay',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
  await writePackage(p,dest);await writeFile(join(dest,'SKILL.md'),'forged skill');
  await assert.rejects(readPackage(dest),refused('PACKAGE_INTEGRITY'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('post-seal manifest rewrite refuses even if syntactically valid',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
  await writePackage(p,dest);
  const altered=JSON.parse(p.files['skill-mason.json']);altered.name='different';
  await writeFile(join(dest,'skill-mason.json'),JSON.stringify(altered)+'\n');
  await assert.rejects(readPackage(dest),refused('PACKAGE_INTEGRITY'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('symlinked package file is refused even if it targets the original bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
  await writePackage(p,dest);
  const contents=await readFile(join(dest,'SKILL.md'));
  const outside=join(root,'outside.md');await writeFile(outside,contents);
  await unlink(join(dest,'SKILL.md'));await symlink(outside,join(dest,'SKILL.md'));
  await assert.rejects(readPackage(dest),refused('PACKAGE_INCOMPLETE'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a symlinked destination parent cannot redirect package output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const outside=join(root,'outside'),linked=join(root,'linked');
  await mkdir(outside);await symlink(outside,linked);
  const p=await composer()(recipe(),[source()]);
  await assert.rejects(writePackage(p,join(linked,'untrusted')),refused('DESTINATION'));
  await assert.rejects(stat(join(outside,'untrusted')),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('concurrent candidate writes produce exactly one complete directory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'contended');
  const outcomes=await Promise.allSettled([writePackage(p,dest),writePackage(p,dest)]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);
  assert.deepEqual(await readPackage(dest),p);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('corrupted completion seal refuses even if source files are unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-seal-test-'));
 try{
  const p=await composer()(recipe(),[source()]),dest=join(root,'sealed');
  await writePackage(p,dest);
  await writeFile(join(dest,'.qortara-complete'),'{"status":"DEVELOPMENT_CANDIDATE"}\n');
  await assert.rejects(readPackage(dest),refused('PACKAGE_INTEGRITY'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('on-disk size bounds use UTF-8 bytes, not JavaScript code-unit length',async()=>{
 const p=await composer()(recipe(),[source()]);
 p.files['SKILL.md']='🙂'.repeat(130_000);
 assert.ok(p.files['SKILL.md'].length<500_000);
 assert.ok(Buffer.byteLength(p.files['SKILL.md'],'utf8')>500_000);
 assert.throws(()=>verifyPackage(p),refused('PACKAGE_SCHEMA'));
});
