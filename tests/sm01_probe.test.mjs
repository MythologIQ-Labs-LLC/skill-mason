/** Stand-in contract tests only; these do NOT execute or qualify a Prism holo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,symlink,rm,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { CASES,options,artifact,main } from '../scripts/sm01_probe.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'sm01-output-'));
 const holo=join(dir,'Eligibility.holo'),bytes=Buffer.from('fake bytes: only preflight tests');
 await writeFile(holo,bytes);
 try{return await fn({holo,dir,sha:sha(bytes)});}finally{await rm(dir,{recursive:true,force:true});}
}
const exited=(text,code=0)=>({status:'exited',exitCode:code,output:new TextEncoder().encode(text)});
const standin=(mapper,seen=[])=>({containers:{run:async(path,bytes,opts)=>{
 seen.push({path,hex:Buffer.from(bytes).toString('hex'),opts});
 return mapper(Buffer.from(bytes).toString('hex'));
}}});
test('twelve fixtures including zero byte and allocation boundary',()=>{
 assert.equal(CASES.length,12);assert.equal(CASES.find(x=>x.id==='all-refused').hex,'00000000');
 assert.equal(CASES.find(x=>x.id==='allocation-boundary').hex.length,1024);
});
test('requires an artifact pin, case whitelist and explicit P0 consent',()=>{
 assert.throws(()=>options(['--holo','x.holo','--sha256','a'.repeat(64)]),{code:'ASSURANCE_HOLD'});
 assert.throws(()=>options(['--holo','x.holo','--sha256','a'.repeat(64),'--allow-p0','--case','fake']),{code:'USAGE'});
 assert.throws(()=>options(['--holo','x.holo','--sha256','a'.repeat(64),'--allow-p0','--allow-p0']),{code:'USAGE'});
});
test('reject missing, empty, symlink and mismatched digest before loading Prism',async()=>{
 await fixture(async({holo,dir,sha:pin})=>{
   await assert.rejects(artifact(join(dir,'gone.holo'),pin),{code:'ARTIFACT_MISSING'});
   await assert.rejects(artifact(holo,'f'.repeat(64)),{code:'DIGEST_MISMATCH'});
   await assert.rejects(artifact(join(dir,'wrong.txt'),pin),{code:'USAGE'});
   const empty=join(dir,'empty.holo');await writeFile(empty,'');
   await assert.rejects(artifact(empty,sha(Buffer.alloc(0))),{code:'ARTIFACT_INVALID'});
   const link=join(dir,'link.holo');await symlink(holo,link);
   await assert.rejects(artifact(link,pin),{code:'ARTIFACT_INVALID'});
   let called=0;
   await assert.rejects(main(['--holo',holo,'--sha256','f'.repeat(64),'--allow-p0'],async()=>{called++;}),{code:'DIGEST_MISMATCH'});
   assert.equal(called,0);
 });
});
test('missing real Prism runtime is a hard failure without fallback',async()=>{
 await fixture(async({holo,sha:pin})=>{
   await assert.rejects(main(['--holo',holo,'--sha256',pin,'--allow-p0'],async()=>{throw Object.assign(Error('absent'),{code:'RUNTIME_MISSING'});}),{code:'RUNTIME_MISSING'});
 });
});
test('stand-in confirms raw input transport, exact output, no policy bypass',async()=>{
 await fixture(async({holo,sha:pin})=>{
   const seen=[],expected=new Map(CASES.map(c=>[c.hex,c.expected]));
   const run=standin(hex=>exited(expected.get(hex)),seen);
   const report=await main(['--holo',holo,'--sha256',pin,'--allow-p0'],async()=>run);
   assert.equal(report.passed,12);assert.equal(report.verdict,'FIXTURE_PASS');
   assert.equal(report.productionEligible,false);
   assert.equal(seen.find(x=>x.hex==='00000000').hex,'00000000');
   assert.equal(seen.find(x=>x.hex.length===1024).hex.length,1024);
   seen.forEach(x=>{assert.deepEqual(x.opts.policy,{minimum:'P0',effects:[]});assert.equal(x.opts.rm,true);assert.equal('allowUnverified' in x.opts,false);});
 });
});
test('wrong output, nonzero exit or Prism exception cannot pass',async()=>{
 await fixture(async({holo,sha:pin})=>{
   const args=['--holo',holo,'--sha256',pin,'--allow-p0','--case','rights'];
   const wrong=await main(args,async()=>standin(()=>exited('eligible')));assert.equal(wrong.verdict,'FIXTURE_FAIL');
   const crashed=await main(args,async()=>standin(()=>exited('refused: RIGHTS_UNRESOLVED',1)));assert.equal(crashed.verdict,'FIXTURE_FAIL');
   const denied=await main(args,async()=>standin(()=>{throw Object.assign(Error('denied'),{code:'VERIFICATION_FAILED'});}));
   assert.equal(denied.verdict,'FIXTURE_FAIL');assert.equal(denied.tests[0].error,'VERIFICATION_FAILED');
 });
});
test('evidence report uses exclusive create and exact SHA',async()=>{
 await fixture(async({holo,dir,sha:pin})=>{
   const output=join(dir,'output.json'),args=['--holo',holo,'--sha256',pin,'--allow-p0','--case','eligible','--report',output];
   await main(args,async()=>standin(()=>exited('eligible')));
   assert.equal(JSON.parse(await readFile(output,'utf8')).artifact.sha256,pin);
   await assert.rejects(main(args,async()=>standin(()=>exited('eligible'))),{code:'EEXIST'});
 });
});
