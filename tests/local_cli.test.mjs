/** Stand-in contract tests only: NO real holo or production assurance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {parseCommand,localStatus,evaluate,run,createRequest,requestPythonArgs,discoverRoutes,routePythonArgs} from '../bin/qortara-skills.mjs';

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


const REQUEST_ARGS=['create','--request',
  'Review dependency supply chain evidence and report actionable security findings',
  '--route','security/supply-chain',
  '--host','ChatGPT',
  '--handoff','/pinned/handoff',
  '--source-checkout','/pinned/source'];
const REFUSED={
  schema:'qortara/request-to-skill-evaluation/1',
  state:'REFUSED_PRE_ADMISSION',
  refusal:{schema:'qortara/skill-generation-refusal/1',
    code:'RIGHTS_UNRESOLVED',no_method_composed:true},
  prism_invoked:false,composer_invoked:false,
  output_package_created:false,production_eligible:false
};

test('Gherkin: create uses the shared Python source inspector with bounded required inputs',async()=>{
 const cmd=parseCommand(REQUEST_ARGS);
 assert.equal(cmd.command,'create');
 assert.equal(cmd.flags['--route'],'security/supply-chain');
 const result=await run(REQUEST_ARGS,{requestRunner:async flags=>{
  assert.equal(flags['--host'],'ChatGPT');
  assert.equal(flags['--request'],REQUEST_ARGS[2]);
  return REFUSED;
 }});
 assert.equal(result.exitCode,2,'policy refusal is not executable success');
 assert.equal(result.value.refusal.code,'RIGHTS_UNRESOLVED');
 assert.equal(result.value.composer_invoked,false);
 assert.equal(result.value.production_eligible,false);
});
test('Gherkin: create never accepts user or model forged rights as a real positive result',async()=>{
 for(const malicious of [
  {...REFUSED,production_eligible:true},
  {...REFUSED,composer_invoked:true},
  {...REFUSED,prism_invoked:true},
  {...REFUSED,state:'COMPLETED',production_eligible:true},
  {...REFUSED,refusal:{...REFUSED.refusal,no_method_composed:false}},
 ]) {
  await assert.rejects(createRequest(parseCommand(REQUEST_ARGS).flags,{
   requestRunner:async()=>malicious}),{code:'UNTRUSTED_PROMOTION'});
 }
});
test('Gherkin: create options enforce external identity and prohibit P0 fixture bypass',()=>{
 assert.throws(()=>parseCommand(['create']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...REQUEST_ARGS,'--allow-p0']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...REQUEST_ARGS,'--holo','x']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...REQUEST_ARGS,'--external-checkout','/repo']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...REQUEST_ARGS,
  '--external-checkout','/repo','--external-repository-tree','a'.repeat(40)]),{code:'USAGE'});
 const complete=parseCommand([...REQUEST_ARGS,'--method','governed:some/method',
  '--external-checkout','/repo','--external-repository-tree','a'.repeat(40)]);
 assert.equal(complete.flags['--method'],'governed:some/method');
});
test('Gherkin: request evaluation report is exclusive and never overwrites evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qortara-request-cli-'));
 const file=join(dir,'refusal.json');
 try{
  const args=[...REQUEST_ARGS,'--report',file];
  const deps={requestRunner:async()=>REFUSED};
  const out=await run(args,deps);
  assert.equal(out.exitCode,2);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),REFUSED);
  await assert.rejects(run(args,deps),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('Gherkin: Python source paths resolve against invoking caller, not checked-in CLI cwd',()=>{
 const caller=join(tmpdir(),'operator workspace','nested');
 const f={...parseCommand(REQUEST_ARGS).flags,
   '--handoff':'../original skillz handoff',
   '--source-checkout':'../original skillz source',
   '--external-checkout':'../separate external checkout',
   '--external-repository-tree':'f'.repeat(40),
   '--method':'governed:anthropic-skills/frontend-design'};
 const argv=requestPythonArgs(f,caller);
 for(const [flag,input] of [
  ['--handoff','../original skillz handoff'],
  ['--source-checkout','../original skillz source'],
  ['--external-checkout','../separate external checkout']
 ]) {
  assert.equal(argv[argv.indexOf(flag)+1],resolve(caller,input));
 }
 assert.equal(argv[argv.indexOf('--external-repository-tree')+1],'f'.repeat(40));
 assert.equal(argv[argv.indexOf('--method')+1],f['--method']);
 assert.equal(argv[argv.indexOf('--request')+1],f['--request']);
 assert.ok(argv.every(x=>typeof x==='string'),'all inputs remain literal shell-free argv');
});


const ROUTE_PATH='software-engineering/frontend';
const ROUTE_ARGS=[
 'routes','--search','frontend',
 '--handoff','/pinned/handoff','--source-checkout','/pinned/source'
];
const ROUTE_DETAIL={
 schema:'qortara/capability-opportunity-graph/1',
 source_commit:'31a8c518dd97b7828adcc728202fa41388a306d7',
 path:ROUTE_PATH,recognized:true,composition_eligible:false,
 essential_outcomes:['Accessible frontend implementation'],
 evidence_linked_reviews:[{record_id:'anthropic-skills/frontend-design',
  composition_eligibility:'not-assessed',rights_clearance:'not-established'}]
};
const ROUTE_RESULT={
 schema:'qortara/user-route-discovery/1',
 state:'READ_ONLY_RECOGNIZED_CAPABILITIES',
 mode:'SEARCH',
 pinned_source_commit:'31a8c518dd97b7828adcc728202fa41388a306d7',
 pinned_source_tree:'e6d5dfeb42bcd7777ddff52605922fead62135ff',
 recognized_domain_count:33,recognized_route_count:247,
 source_rights_established:false,host_validated:false,
 search_is_lexical_not_qualified_semantics:true,
 composition_eligible:false,production_eligible:false,
 routes:[ROUTE_DETAIL],matched_route_count:1
};

test('Gherkin: ordinary routes command returns inspectable real route without approval',async()=>{
 const out=await run(ROUTE_ARGS,{routeRunner:async flags=>{
  assert.equal(flags['--search'],'frontend');
  return ROUTE_RESULT;
 }});
 assert.equal(out.exitCode,0);
 assert.equal(out.value.routes[0].path,ROUTE_PATH);
 assert.equal(out.value.routes[0].evidence_linked_reviews[0].rights_clearance,'not-established');
 assert.equal(out.value.production_eligible,false);
});

test('Gherkin: route choice requires explicit bounded option, no P0 bypass',()=>{
 assert.throws(()=>parseCommand(['routes']),{code:'USAGE'});
 const root=['routes','--handoff','/h','--source-checkout','/s'];
 assert.throws(()=>parseCommand([...root,'--search','frontend','--path',ROUTE_PATH]),{code:'USAGE'});
 assert.throws(()=>parseCommand([...root,'--search','frontend','--limit','26']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...root,'--path',ROUTE_PATH,'--limit','10']),{code:'USAGE'});
 assert.throws(()=>parseCommand([...root,'--summary','--allow-p0']),{code:'USAGE'});
 assert.equal(parseCommand([...root,'--summary']).flags['--summary'],true);
 assert.equal(parseCommand([...root,'--path',ROUTE_PATH]).flags['--path'],ROUTE_PATH);
});

test('Gherkin: candidate route path input binds to original caller cwd',()=>{
 const caller=join(tmpdir(),'operator route workspace');
 const flags=parseCommand(['routes','--search','frontend','--handoff','../handoff',
  '--source-checkout','../source','--limit','4']).flags;
 const args=routePythonArgs(flags,caller);
 assert.equal(args[args.indexOf('--handoff')+1],resolve(caller,'../handoff'));
 assert.equal(args[args.indexOf('--source-checkout')+1],resolve(caller,'../source'));
 assert.equal(args[args.indexOf('--limit')+1],'4');
 assert.equal(args[args.indexOf('--search')+1],'frontend');
});

test('Gherkin: forged route authority or substituted source cannot be accepted',async()=>{
 const flags=parseCommand(ROUTE_ARGS).flags;
 for(const malicious of [
  {...ROUTE_RESULT,production_eligible:true},
  {...ROUTE_RESULT,source_rights_established:true},
  {...ROUTE_RESULT,pinned_source_commit:'f'.repeat(40)},
  {...ROUTE_RESULT,recognized_route_count:248},
  {...ROUTE_RESULT,routes:[{...ROUTE_DETAIL,composition_eligible:true}]},
  {...ROUTE_RESULT,routes:[{...ROUTE_DETAIL,evidence_linked_reviews:[
   {...ROUTE_DETAIL.evidence_linked_reviews[0],rights_clearance:'approved'}]}]},
 ]) {
  await assert.rejects(discoverRoutes(flags,{routeRunner:async()=>malicious}),
   {code:'ROUTE_PROMOTION'});
 }
});

test('Gherkin: unknown route has typed nonzero refusal; no guessed method',async()=>{
 const flags=parseCommand(['routes','--path','not-a-real/route',
   '--handoff','/h','--source-checkout','/s']).flags;
 const out=await run(['routes','--path','not-a-real/route',
   '--handoff','/h','--source-checkout','/s'],{
  routeRunner:async()=>({schema:'qortara/user-route-discovery/1',state:'REFUSED',
   code:'UNRECOGNIZED_CAPABILITY',production_eligible:false,composition_eligible:false})
 });
 assert.equal(out.exitCode,2);
 assert.equal(out.value.code,'UNRECOGNIZED_CAPABILITY');
 assert.equal(flags['--path'],'not-a-real/route');
});

test('Gherkin: route report uses exclusive write and preserves existing evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qortara-routes-'));
 const file=join(dir,'routes.json');
 const args=[...ROUTE_ARGS,'--report',file];
 try {
  const deps={routeRunner:async()=>ROUTE_RESULT};
  assert.equal((await run(args,deps)).exitCode,0);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),ROUTE_RESULT);
  await assert.rejects(run(args,deps),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
