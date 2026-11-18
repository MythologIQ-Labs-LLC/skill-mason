import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {APP_NAME,WebError,normalizeSha,decodeHex,hexOf,openHolo,runGuest,runFixtures} from '../src/core.mjs';
import {CASES} from '../src/fixtures.mjs';
import {CASES as CLI_CASES} from '../../scripts/sm01_probe.mjs';
const bytes=new TextEncoder().encode('fixture only, not Prism');
const digest=createHash('sha256').update(bytes).digest('hex');
const file={name:'App.holo',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(0)};
const app=(answer='eligible')=>({name:APP_NAME,
  experimental_verify:async()=>({passed:true,level:'P0',reasons:[]}),
  dispatch:async()=>new TextEncoder().encode(answer)});
const open=(name=APP_NAME,answer='eligible')=>openHolo(file,digest,
  async()=>({...app(answer),name}),webcrypto);
test('web fixture list equals local CLI contract byte-for-byte',()=>{
 assert.deepEqual(CASES,CLI_CASES);assert.equal(CASES.length,12);
});
test('sha256 requires an independently supplied lowercase pin',()=>{
 assert.equal(normalizeSha(digest),digest);
 assert.throws(()=>normalizeSha(digest.toUpperCase()),{code:'SHA_REQUIRED'});
 assert.throws(()=>normalizeSha(''),{code:'SHA_REQUIRED'});
});
test('raw hex permits embedded NUL, empty and 512 byte limit',()=>{
 assert.equal(hexOf(decodeHex('00010101')),'00010101');
 assert.equal(decodeHex('').byteLength,0);
 assert.equal(decodeHex('ff'.repeat(512)).byteLength,512);
 assert.throws(()=>decodeHex('f'),{code:'INPUT_INVALID'});
 assert.throws(()=>decodeHex('gg'),{code:'INPUT_INVALID'});
 assert.throws(()=>decodeHex('aa'.repeat(513)),{code:'INPUT_INVALID'});
});
test('wrong hash refuses before loading executable bytes',async()=>{
 let called=0;
 await assert.rejects(openHolo(file,'f'.repeat(64),async()=>{called++;},webcrypto),{code:'DIGEST_MISMATCH'});
 assert.equal(called,0);
});
test('reject wrong app identity, failed pure policy and unsupported guest',async()=>{
 await assert.rejects(open('Unrelated application'),{code:'WRONG_APP'});
 await assert.rejects(openHolo(file,digest,async()=>({...app(),
   experimental_verify:async()=>({passed:false,level:'P0',reasons:[{code:'effects'}]})}),webcrypto),{code:'VERIFY_REFUSED'});
 await assert.rejects(openHolo(file,digest,async()=>({name:APP_NAME}),webcrypto),{code:'SDK_INTERFACE'});
});
test('explicit P0 policy is passed to Prism; output is from guest only',async()=>{
 let opts=null,observed=null;
 const s=await openHolo(file,digest,async()=>({name:APP_NAME,
   experimental_verify:async o=>{opts=o;return {passed:true,level:'P0'};},
   dispatch:async b=>{observed=hexOf(b);return new TextEncoder().encode('refused: RIGHTS_UNRESOLVED');}}),webcrypto);
 const res=await runGuest(s,'01000101');
 assert.deepEqual(opts,{minimum:'P0',effects:[]});
 assert.equal(observed,'01000101');assert.equal(res.response,'refused: RIGHTS_UNRESOLVED');
 assert.equal(res.productionEligible,false);
});
test('prism errors, malformed UTF8 and wrong outputs must not pass',async()=>{
 const s=await open();
 s.app.dispatch=async()=>{throw Object.assign(Error('denied'),{code:'GUEST_TRAP'});};
 await assert.rejects(runGuest(s,'01010101'),{code:'PRISM_REFUSAL'});
 s.app.dispatch=async()=>new Uint8Array([255]);
 await assert.rejects(runGuest(s,'01010101'),{code:'OUTPUT_UTF8'});
 s.app.dispatch=async()=>new TextEncoder().encode('unexpected');
 const r=await runFixtures(s,[CASES[0]]);
 assert.equal(r.verdict,'FIXTURE_FAIL');assert.equal(r.passed,0);
});
test('actual 12-vector runner returns pass only for guest outputs; no fallback',async()=>{
 const fixtureByHex=new Map(CASES.map(c=>[c.hex,c.expected]));
 const s=await open();
 s.app.dispatch=async b=>new TextEncoder().encode(fixtureByHex.get(hexOf(b)));
 const r=await runFixtures(s,CASES);
 assert.equal(r.passed,12);assert.equal(r.total,12);
 assert.equal(r.verdict,'FIXTURE_PASS');assert.equal(r.productionEligible,false);
});
test('session-less browser action and oversized file are refused',async()=>{
 await assert.rejects(runGuest(null,'01010101'),{code:'NOT_READY'});
 await assert.rejects(openHolo({...file,size:65*1024*1024},digest,async()=>app(),webcrypto),{code:'HOLO_SIZE'});
});
