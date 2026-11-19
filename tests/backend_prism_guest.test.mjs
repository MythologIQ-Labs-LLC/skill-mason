import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign as signEd25519} from 'node:crypto';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPinnedPrismGuest} from '../src/backend/prism-guest.mjs';
import {createComposer,canonicalJSON,verifyPackage} from '../src/backend/compose.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed='01010101',rightsDenied='01000101';
const fixtureArtifact=Buffer.from('P0 synthetic holo bytes; NOT a real compiled Prism artifact\n');
const rawGuest=(response='eligible',assertInput=()=>{})=>async()=>({
 containers:{run:async(path,input,opts)=>{
   assert.equal(input instanceof Uint8Array,true);
   assert.deepEqual(opts,{policy:{minimum:'P0',effects:[]},rm:true});
   assert.equal(Object.hasOwn(opts,'allowUnverified'),false);
   assertInput(path,input);
   return {status:'exited',exitCode:0,output:Uint8Array.from(Buffer.from(response))};
 }}
});
async function withHolo(run){
 const root=await mkdtemp(join(tmpdir(),'qortara-prism-guest-'));
 try{
  const path=join(root,'fixture.holo');
  await writeFile(path,fixtureArtifact);
  return await run({path,digest:sha(fixtureArtifact),root});
 }finally{await rm(root,{recursive:true,force:true});}
}
const refuse=code=>({code});
const config=(path,digest,runtime)=>({holoPath:path,holoSha256:digest,
 developmentP0Consent:true,loadRuntime:runtime});
const method=()=>({id:'approved-fixture',origin:'https://example.test/fictional-owner',
 sourcePath:'methods/review.md',commit:'f'.repeat(40),methodVersion:'v1',
 methodText:'Compare code changes against observed test evidence.',
 sha256:sha('Compare code changes against observed test evidence.'),
 covers:['check changes'],containsAssets:false});
const recipe=()=>({schema:'qortara/internal-composition-plan/1',name:'check-changes',
 title:'Check changes',description:'Review observed test evidence.',
 targetHost:'offline-fixture',requiredOutcomes:['check changes'],
 network:false,secrets:false,execution:false});

test('explicit P0 consent is mandatory at bootstrap',()=>{
 assert.throws(()=>createPinnedPrismGuest({holoPath:'/tmp/a.holo',holoSha256:'a'.repeat(64)}),
  refuse('ASSURANCE_HOLD'));
});
test('a relative holo path and noncanonical digest are refused',()=>{
 assert.throws(()=>createPinnedPrismGuest({holoPath:'a.holo',holoSha256:'a'.repeat(64),
  developmentP0Consent:true}),refuse('PRISM_CONFIG'));
 assert.throws(()=>createPinnedPrismGuest({holoPath:'/tmp/a.holo',holoSha256:'A'.repeat(64),
  developmentP0Consent:true}),refuse('PRISM_CONFIG'));
});
test('wrong per-call holo digest refuses before any runtime call',async()=>{
 await withHolo(async({path,digest})=>{
  let loaded=false;
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>{loaded=true;}));
  await assert.rejects(adapter({requestHex:allowed,holoSha256:'b'.repeat(64)}),
   refuse('PRISM_PIN'));
  assert.equal(loaded,false);
 });
});
test('unrecognized caller policy overrides never reach the runtime',async()=>{
 await withHolo(async({path,digest})=>{
  let loaded=false;
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>{loaded=true;}));
  await assert.rejects(adapter({requestHex:allowed,holoSha256:digest,allowUnverified:true}),
   refuse('PRISM_INPUT'));
  assert.equal(loaded,false);
 });
});
test('invalid SM-01 byte lengths and undefined codes cannot reach the holo',async()=>{
 await withHolo(async({path,digest})=>{
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>{throw Error('called');}));
  for(const input of ['','010101','0101010101','ff010101','01020101','0101010a']){
   await assert.rejects(adapter({requestHex:input,holoSha256:digest}),
    refuse('PRISM_INPUT'));
  }
 });
});
test('real pinned consumer is called with exactly four input bytes and no unverified bypass',async()=>{
 await withHolo(async({path,digest})=>{
  let called=0;
  const adapter=createPinnedPrismGuest(config(path,digest,rawGuest('eligible',(_path,input)=>{
   called++;assert.equal(_path,path);
   assert.deepEqual([...input],[1,1,1,1]);
  })));
  const result=await adapter({requestHex:allowed,holoSha256:digest});
  assert.equal(result.status,'GUEST_COMPLETED');
  assert.equal(result.response,'eligible');
  assert.equal(result.responseHex,'656c696769626c65');
  assert.equal(result.productionEligible,false);
  assert.equal(called,1);
 });
});
test('actual holo file digest is rechecked before any runtime is loaded',async()=>{
 await withHolo(async({path,digest})=>{
  await writeFile(path,Buffer.from('different synthetic bytes'));
  let loaded=false;
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>{loaded=true;}));
  await assert.rejects(adapter({requestHex:allowed,holoSha256:digest}),
   refuse('PRISM_UNAVAILABLE'));
  assert.equal(loaded,false);
 });
});
test('a missing holo cannot silently become a JavaScript eligibility decision',async()=>{
 let loaded=false;
 const adapter=createPinnedPrismGuest(config('/absent/qortara-eligibility.holo','a'.repeat(64),
  async()=>{loaded=true;}));
 await assert.rejects(adapter({requestHex:allowed,holoSha256:'a'.repeat(64)}),
  refuse('PRISM_UNAVAILABLE'));
 assert.equal(loaded,false);
});
test('a symlink holo refuses before runtime',async()=>{
 await withHolo(async({path,digest,root})=>{
  const link=join(root,'link.holo');await symlink(path,link);
  let loaded=false;
  const adapter=createPinnedPrismGuest(config(link,digest,async()=>{loaded=true;}));
  await assert.rejects(adapter({requestHex:allowed,holoSha256:digest}),
   refuse('PRISM_UNAVAILABLE'));
  assert.equal(loaded,false);
 });
});
test('runtime exceptions cannot be replaced with a synthetic eligible response',async()=>{
 await withHolo(async({path,digest})=>{
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>{
   throw Object.assign(new Error('runtime unavailable'),{code:'RUNTIME_MISSING'});
  }));
  await assert.rejects(adapter({requestHex:allowed,holoSha256:digest}),
   refuse('PRISM_UNAVAILABLE'));
 });
});
test('runtime guest refusal is passed through, never changed to eligible',async()=>{
 await withHolo(async({path,digest})=>{
  const adapter=createPinnedPrismGuest(config(path,digest,rawGuest('refused: RIGHTS_UNRESOLVED')));
  const result=await adapter({requestHex:rightsDenied,holoSha256:digest});
  assert.equal(result.response,'refused: RIGHTS_UNRESOLVED');
  assert.equal(result.productionEligible,false);
 });
});
test('malformed UTF-8 guest output refuses without false admission',async()=>{
 await withHolo(async({path,digest})=>{
  const adapter=createPinnedPrismGuest(config(path,digest,async()=>({
   containers:{run:async()=>({status:'exited',exitCode:0,output:Uint8Array.from([255])})}
  })));
  const result=await adapter({requestHex:allowed,holoSha256:digest});
  assert.equal(result.status,'RUNTIME_REFUSED');
  assert.equal(result.response,null);
 });
});
test('complete signed-claim to P0 Prism guest to candidate-package path is byte-repeatable',async()=>{
 await withHolo(async({path,digest})=>{
  const now=1784419200;
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const pem=publicKey.export({type:'spki',format:'pem'}).toString('utf8');
  const keySha=sha(publicKey.export({type:'spki',format:'der'}));
  const evidence=Object.fromEntries(['evidence','rights','authority','coverage']
   .map(k=>[k,Buffer.from('fixture review evidence for '+k)]));
  const evidenceDigests=Object.fromEntries(Object.entries(evidence).map(([k,v])=>[k,sha(v)]));
  const signed=createSignedAssertionAdapter({
   trust:{schema:'qortara/method-assertion-trust/1',issuer:'fixture.issuer',
     keyId:'fixture-key-01',publicKeyPem:pem,publicKeySha256:keySha,policyRevision:'pilot.v1',
     revocations:{validFrom:now-600,expiresAt:now+600,proofDigests:[]}},
   loadEnvelope:async subjectSha256=>{
     const payload={schema:'qortara/method-assertion/1',subjectSha256,
       issuer:'fixture.issuer',keyId:'fixture-key-01',policyRevision:'pilot.v1',
       validFrom:now-60,expiresAt:now+60,
       facts:{evidence:true,rights:true,authority:true,coverage:true},evidenceDigests};
     return {schema:'qortara/signed-method-assertion/1',payload,
       signature:signEd25519(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+canonicalJSON(payload)),
          privateKey).toString('base64url')};
   },
   readEvidence:async({field})=>evidence[field],nowEpoch:()=>now
  });
  const guest=createPinnedPrismGuest(config(path,digest,rawGuest()));
  const compose=createComposer({assertMethod:signed,runPrism:guest,holoSha256:digest});
  const first=await compose(recipe(),[method()]);
  const second=await compose(recipe(),[method()]);
  assert.deepEqual(first,second);
  assert.equal(verifyPackage(first).state,'INTEGRITY_VERIFIED');
  assert.equal(JSON.parse(first.files['RECEIPT.json']).productionEligible,false);
  assert.equal(JSON.parse(first.files['RECEIPT.json']).modelCallsMeasured,false);
 });
});
