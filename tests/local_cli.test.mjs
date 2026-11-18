/** Stand-in contract tests only: NO real holo or production assurance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {parseCommand,localStatus,evaluate,run} from '../bin/qortara-skills.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
async function withHolo(fn){
 const dir=await mkdtemp(join(tmpdir(),'qortara-cli-'));
 const bytes=Buffer.from('stand-in fixture, NOT a compiled holo');
 const holo=join(dir,'Eligibility.holo');await writeFile(holo,bytes);
 try{return await fn({holo,digest:sha(bytes),dir});}
 finally{await rm(dir,{recursive:true,force:true});}
}
const runtime=(respond,observed=[])=>({containers:{run:async(path,input,options)=>{
 observed.push({path,hex:Buffer.from(input).toString('hex'),options});
 return respond();
}}});
const completed=text=>({status:'exited',exitCode:0,output:new TextEncoder().encode(text)});

test('offline help/version never need SDK',async()=>{
 assert.match((await run(['help'])).value,/development-only Prism client/);
 assert.equal((await run(['version'])).value,'0.1.0-dev.0');
});
test('unknown build, invalid flags, absent SHA and no P0 consent refuse',()=>{
 assert.throws(()=>parseCommand(['build']),{code:'USAGE'});
 assert.throws(()=>parseCommand(['evaluate','--hex','01010101']),{code:'USAGE'});
 assert.throws(()=>parseCommand(['evaluate','--holo','x.holo','--sha256','a'.repeat(64),'--hex','01010101']),{code:'ASSURANCE_HOLD'});
 assert.throws(()=>parseCommand(['status','--holo','x.holo']),{code:'USAGE'});
 assert.throws(()=>parseCommand(['status','--json','--json']),{code:'USAGE'});
});
test('raw NUL bytes reach only the provided Prism container; no secondary rules',async()=>{
 await withHolo(async({holo,digest})=>{
  const seen=[];
  const result=await evaluate({'--holo':holo,'--sha256':digest,'--hex':'00010101'},
    async()=>runtime(()=>completed('refused: EVIDENCE_UNQUALIFIED'),seen));
  assert.equal(result.response,'refused: EVIDENCE_UNQUALIFIED');
  assert.equal(result.status,'GUEST_COMPLETED');
  assert.equal(result.productionEligible,false);
  assert.equal(seen[0].hex,'00010101');
  assert.deepEqual(seen[0].options,{policy:{minimum:'P0',effects:[]},rm:true});
  assert.equal('allowUnverified' in seen[0].options,false);
 });
});
test('guest output is distinct from failed Prism check, trap, and invalid UTF-8',async()=>{
 await withHolo(async({holo,digest})=>{
  const args=['evaluate','--holo',holo,'--sha256',digest,'--hex','01010101','--allow-p0'];
  assert.equal((await run(args,{loadRuntime:async()=>runtime(()=>completed('eligible'))})).exitCode,0);
  assert.equal((await run(args,{loadRuntime:async()=>runtime(()=>({...completed('eligible'),exitCode:1}))})).exitCode,1);
  assert.equal((await run(args,{loadRuntime:async()=>runtime(()=>{throw Object.assign(Error('deny'),{code:'POLICY_DENIED'});})})).value.status,'RUNTIME_ERROR');
  assert.equal((await run(args,{loadRuntime:async()=>runtime(()=>({status:'exited',exitCode:0,output:new Uint8Array([255])}))})).exitCode,1);
 });
});
test('digest mismatch stops before load; status never claims production qualified',async()=>{
 await withHolo(async({holo,digest})=>{
  const flags={'--holo':holo,'--sha256':digest};
  const ok=await localStatus(flags,{nodeVersion:'22.16.0',runtimePackage:{version:'0.9.5'}});
  assert.equal(ok.preflightReady,true);
  assert.equal(ok.productionReady,false);
  assert.equal((await localStatus(flags,{nodeVersion:'20.1.0',runtimePackage:{version:'0.9.5'}})).preflightReady,false);
  assert.equal((await localStatus(flags,{runtimePackage:{version:'1.0.0'}})).runtime.status,'VERSION_MISMATCH');
  let calls=0;
  await assert.rejects(evaluate({'--holo':holo,'--sha256':'f'.repeat(64),'--hex':'01010101'},async()=>{calls++;}),{code:'DIGEST_MISMATCH'});
  assert.equal(calls,0);
 });
});
test('request hex may be empty or 512 bytes, never odd or larger',()=>{
 const args=['evaluate','--holo','x.holo','--sha256','a'.repeat(64),'--allow-p0','--hex'];
 assert.equal(parseCommand([...args,'']).flags['--hex'],'');
 assert.equal(parseCommand([...args,'00'.repeat(512)]).flags['--hex'].length,1024);
 for(const hex of ['a','xz','00'.repeat(513)])assert.throws(()=>parseCommand([...args,hex]),{code:'USAGE'});
});
test('probe delegates to real-holo harness; cannot overwrite report',async()=>{
 await withHolo(async({holo,digest,dir})=>{
  const args=['probe','--holo',holo,'--sha256',digest,'--allow-p0','--case','eligible','--report',join(dir,'probe.json')];
  const deps={loadRuntime:async()=>runtime(()=>completed('eligible'))};
  assert.equal((await run(args,deps)).exitCode,0);
  assert.equal(JSON.parse(await readFile(join(dir,'probe.json'),'utf8')).passed,1);
  await assert.rejects(run(args,deps),{code:'EEXIST'});
 });
});
test('evaluate creates report exclusively, records exact Prism output',async()=>{
 await withHolo(async({holo,digest,dir})=>{
  const args=['evaluate','--holo',holo,'--sha256',digest,'--hex','01010101','--allow-p0','--report',join(dir,'result.json')];
  const deps={loadRuntime:async()=>runtime(()=>completed('eligible'))};
  assert.equal((await run(args,deps)).exitCode,0);
  assert.equal(JSON.parse(await readFile(join(dir,'result.json'),'utf8')).responseHex,'656c696769626c65');
  await assert.rejects(run(args,deps),{code:'EEXIST'});
 });
});
