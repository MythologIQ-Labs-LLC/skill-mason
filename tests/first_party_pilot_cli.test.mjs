import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs,runFirstPartyPilot,DEV_HOLO_SHA256} from '../bin/first-party-pilot.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,PILOT_SOURCE_COMMIT,PILOT_V2_SOURCE_COMMIT,PILOT_SNAPSHOT_COMMIT}
  from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';

test('four original first-party methods preserve individually pinned historical source commits',async()=>{
 const registry=await loadFirstPartyPilots();
 assert.equal(registry.sourceSnapshot.commit,PILOT_SNAPSHOT_COMMIT);
 assert.equal(registry.components.length,4);
 assert.match(registry.sourceSnapshot.sha256,/^[0-9a-f]{64}$/);
 for(const p of registry.components){
   assert.match(p.package_sha256,/^[0-9a-f]{64}$/);
   assert.equal(p.method.sha256,p.package_sha256);
   const definition=PILOT_DEFINITIONS.find(x=>x.id===p.method_id);
   assert.equal(p.method.commit,definition.sourceCommit??PILOT_SOURCE_COMMIT);
   if (p.method_id==='ci-failure-triage-v2')
     assert.equal(p.method.commit,PILOT_V2_SOURCE_COMMIT);
   if (p.method_id==='ci-failure-triage-v3')
     assert.equal(p.method.commit,PILOT_SNAPSHOT_COMMIT);
   const publicRecipe=recipeForPilot(p.method_id,registry);
   assert.equal(createRecipeAdapter(registry)(publicRecipe).methods[0].id,p.method_id);
 }
});
test('fixture-only command parses all mandatory inputs and no unknown options',()=>{
 const args=['--id',PILOT_DEFINITIONS[0].id,'--holo','/tmp/a.holo',
  '--sha256',DEV_HOLO_SHA256,'--output-root','/tmp/target','--dev-p0-fixture'];
 const result=parseArgs(args);
 assert.deepEqual(result,{id:'ci-failure-triage',holoPath:'/tmp/a.holo',
  holoSha256:DEV_HOLO_SHA256,outputRoot:'/tmp/target',devP0Fixture:true});
});
test('no ordinary command can implicitly authorize synthetic source assertions',()=>{
 const args=['--id','ci-failure-triage','--holo','/tmp/a.holo',
  '--sha256',DEV_HOLO_SHA256,'--output-root','/tmp/target'];
 assert.throws(()=>parseArgs(args),{code:'USAGE'});
});
test('duplicate or unknown command options fail closed',()=>{
 assert.throws(()=>parseArgs(['--dev-p0-fixture','--dev-p0-fixture']),{code:'USAGE'});
 assert.throws(()=>parseArgs(['--unsafe-allow-eligible']),{code:'USAGE'});
 assert.throws(()=>parseArgs(['--id','ci-failure-triage','--id','governance-drift-review']),{code:'USAGE'});
});
test('programmatic pilot cannot bypass explicit P0 fixture consent',async()=>{
 await assert.rejects(runFirstPartyPilot({id:'ci-failure-triage',
  holoPath:'/tmp/any.holo',holoSha256:DEV_HOLO_SHA256,outputRoot:'/tmp'}),{code:'FIXTURE_CONSENT'});
});
test('programmatic pilot rejects wrong native holo pin before any files are written',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-pilot-args-'));
 try{
  await assert.rejects(runFirstPartyPilot({id:'ci-failure-triage',
   holoPath:'/tmp/any.holo',holoSha256:'f'.repeat(64),outputRoot:root,
   devP0Fixture:true}),{code:'PILOT_PIN'});
  await assert.rejects(stat(join(root,'ci-failure-triage')),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unsupported pilot identity and relative output paths refuse',async()=>{
 await assert.rejects(runFirstPartyPilot({id:'other-pilot',
  holoPath:'/tmp/any.holo',holoSha256:DEV_HOLO_SHA256,outputRoot:'/tmp',
  devP0Fixture:true}),{code:'PILOT_UNKNOWN'});
 await assert.rejects(runFirstPartyPilot({id:'ci-failure-triage',
  holoPath:'/tmp/any.holo',holoSha256:DEV_HOLO_SHA256,
  outputRoot:'./relative',devP0Fixture:true}),{code:'OUTPUT_ROOT'});
});
test('a nonexistent real holo refuses and never produces an incomplete candidate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-pilot-missing-'));
 try{
  await assert.rejects(runFirstPartyPilot({id:'ci-failure-triage',
   holoPath:'/missing/untrusted-p0-artifact.holo',holoSha256:DEV_HOLO_SHA256,
   outputRoot:root,devP0Fixture:true}),{code:'PRISM_UNAVAILABLE'});
  await assert.rejects(stat(join(root,'ci-failure-triage')),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
