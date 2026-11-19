import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign as signEd25519} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createComposer,verifyPackage,writePackage,readPackage,canonicalJSON} from '../src/backend/compose.mjs';
import {createSignedAssertionAdapter} from '../src/backend/signed-assertions.mjs';

const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const SOURCE={repository:'https://example.test/pinned-discovery',commit:'a'.repeat(40),sha256:'b'.repeat(64)};
const HOLO='c'.repeat(64);
function entry(id='review-method',outcome='review changes'){
 const methodText='Check declared task evidence for '+outcome+'.';
 const bytes=Buffer.from('fixture package '+id+' bytes\n'+methodText+'\n','utf8');
 return {
   method_id:id,package_id:'fixture/'+id,package_sha256:SHA(bytes),packageBytes:bytes,
   method:{
     id,origin:'https://example.test/first-party-fixture',sourcePath:'methods/'+id+'.md',
     commit:'d'.repeat(40),sha256:SHA(Buffer.from(methodText,'utf8')),
     methodVersion:'fixture-v1',methodText,covers:[outcome],containsAssets:false
   }
 };
}
const registry=()=>({sourceSnapshot:{...SOURCE},
 supportedHosts:['offline-agent-fixture','offline-review-fixture'],
 components:[entry(),entry('test-summary','summarize test evidence')]});
function recipe(){
 const m=entry();
 return {schema_version:'skill-mason.recipe.v0',skill_id:'review-changes',
 title:'Review changes',description:'Inspect changes and document evidence.',
 target_host:'offline-agent-fixture',required_outcomes:['review changes'],
 source_snapshot:{...SOURCE},
 components:[{method_id:m.method_id,package_id:m.package_id,package_sha256:m.package_sha256}],
 authority:{network:false,secrets:false,execution:false}};
}
const reject=code=>({code});
const assertMethod=async({subjectSha256})=>({
 evidence:true,rights:true,authority:true,coverage:true,
 issuer:'fixture-signed-issuer',subjectSha256,proofDigest:'f'.repeat(64)
});
const guest=async({requestHex,holoSha256})=>{
 assert.equal(holoSha256,HOLO);
 const response=requestHex==='01010101'?'eligible':'refused: RIGHTS_UNRESOLVED';
 return {schema:'qortara/local-eligibility-result/1',application:'Qortara Skills Eligibility',
  status:'GUEST_COMPLETED',engine:'prism-code@0.9.5',requestHex,
  artifact:{sha256:HOLO},exitCode:0,productionEligible:false,
  response,responseHex:Buffer.from(response).toString('hex')};
};
const composer=()=>createComposer({assertMethod,runPrism:guest,holoSha256:HOLO});

test('the exact public recipe becomes a pinned internal plan, not an eligibility claim',()=>{
 const {plan,methods}=createRecipeAdapter(registry())(recipe());
 assert.equal(plan.schema,'qortara/internal-composition-plan/1');
 assert.equal(plan.sourceSnapshot.sha256,SOURCE.sha256);
 assert.deepEqual(plan.packagePins,[{methodId:'review-method',packageId:'fixture/review-method',
  sha256:entry().package_sha256}]);
 assert.equal(methods.length,1);
 assert.equal(Object.hasOwn(plan,'eligible'),false);
 assert.equal(Object.isFrozen(plan),true);
});
test('two methods serving two outcomes deterministically build a candidate with complete package pins',async()=>{
 const registryConfig=registry(),r=recipe(),e=registryConfig.components[1];
 r.required_outcomes.push('summarize test evidence');
 r.components.push({method_id:e.method_id,package_id:e.package_id,package_sha256:e.package_sha256});
 const adapt=createRecipeAdapter(registryConfig);
 const a=adapt(r),out=await composer()(a.plan,a.methods);
 assert.equal(verifyPackage(out).state,'INTEGRITY_VERIFIED');
 const sources=JSON.parse(out.files['SOURCES.json']);
 assert.equal(sources.sourceSnapshot.sha256,SOURCE.sha256);
 assert.deepEqual(sources.packagePins.map(x=>x.methodId),['review-method','test-summary']);
 assert.equal(JSON.parse(out.files['RECEIPT.json']).productionEligible,false);
 assert.equal(JSON.parse(out.files['RECEIPT.json']).hostValidated,false);
 assert.deepEqual(out,await composer()(a.plan,a.methods));
});
test('reordered requested outcomes and components produce byte-identical candidate outputs',async()=>{
 const registryConfig=registry(),r=recipe(),e=registryConfig.components[1];
 r.required_outcomes.push('summarize test evidence');
 r.components.push({method_id:e.method_id,package_id:e.package_id,package_sha256:e.package_sha256});
 const reverse=structuredClone(r);
 reverse.required_outcomes.reverse();
 reverse.components.reverse();
 const adapt=createRecipeAdapter(registryConfig);
 const a=adapt(r),b=adapt(reverse),build=composer();
 assert.deepEqual(await build(a.plan,a.methods),await build(b.plan,b.methods));
});
test('unknown method IDs never trigger fuzzy method matching',()=>{
 const r=recipe();r.components[0].method_id='similar-method';
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('UNKNOWN_ID'));
});
test('a mismatched requested package pin refuses',()=>{
 const r=recipe();r.components[0].package_sha256='0'.repeat(64);
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('SOURCE_MISMATCH'));
});
test('mismatched source snapshot refuses even with correctly pinned component',()=>{
 const r=recipe();r.source_snapshot.commit='9'.repeat(40);
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('UNTRUSTED_CATALOG'));
});
test('a supported string cannot be used for an unqualified host',()=>{
 const r=recipe();r.target_host='real-host-not-qualified';
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('HOST_UNSUPPORTED'));
});
test('uncovered essential outcomes explicitly refuse, without plausible inference',()=>{
 const r=recipe();r.required_outcomes=['review security of cloud infrastructure'];
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('OUTCOME_UNCOVERED'));
});
test('no component selection cannot produce an empty plausible skill',()=>{
 const r=recipe();r.components=[];
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('INVALID_RECIPE'));
});
test('any new execution, secrets or network grant refuses',()=>{
 for(const k of ['network','secrets','execution']){
  const r=recipe();r.authority[k]=true;
  assert.throws(()=>createRecipeAdapter(registry())(r),reject('AUTHORITY_EXCEEDED'));
 }
});
test('unapproved parameter substitution refuses without executing content',()=>{
 const r=recipe();r.components[0].parameters={command:'curl https://example.test'};
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('PARAMETERS_UNSUPPORTED'));
});
test('empty, explicit parameters are allowed but cannot affect canonical plan',()=>{
 const r=recipe();r.components[0].parameters={};
 const a=createRecipeAdapter(registry());
 assert.deepEqual(a(r),a(recipe()));
});
test('unknown public recipe fields refuse',()=>{
 const r=recipe();r.force_eligible=true;
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('INVALID_RECIPE'));
});
test('nested source package bytes must match the operator-held digest',()=>{
 const c=registry();c.components[0].packageBytes=Buffer.from('attacker replaced source');
 assert.throws(()=>createRecipeAdapter(c),reject('SOURCE_MISMATCH'));
});
test('the actual selected method text must match its independently pinned digest',()=>{
 const c=registry();c.components[0].method.methodText+=' changed';
 assert.throws(()=>createRecipeAdapter(c),reject('SOURCE_MISMATCH'));
});
test('missing full-package bytes refuse; source metadata alone is never enough',()=>{
 const c=registry();delete c.components[0].packageBytes;
 assert.throws(()=>createRecipeAdapter(c),reject('SOURCE_RECORD'));
});
test('source code with unqualified nested assets refuses',()=>{
 const c=registry();c.components[0].method.containsAssets=true;
 assert.throws(()=>createRecipeAdapter(c),reject('RIGHTS_UNRESOLVED'));
});
test('ambiguous duplicate operator source records refuse',()=>{
 const c=registry();c.components.push(c.components[0]);
 assert.throws(()=>createRecipeAdapter(c),reject('SOURCE_RECORD'));
});
test('an operator registry mutation after bootstrap cannot swap selected source claims',()=>{
 const c=registry(),adapt=createRecipeAdapter(c);
 c.components[0].packageBytes[0]=0;
 c.components[0].method.methodText='forged instructions';
 c.supportedHosts[0]='arbitrary-new-host';
 const result=adapt(recipe());
 assert.match(result.methods[0].methodText,/Check declared task evidence/);
 assert.throws(()=>{result.plan.sourceSnapshot.commit='0'.repeat(40);},TypeError);
 const r=recipe();r.target_host='arbitrary-new-host';
 assert.throws(()=>adapt(r),reject('HOST_UNSUPPORTED'));
});
test('composer rejects public binding manipulation that removes method/package mapping',async()=>{
 const {plan,methods}=createRecipeAdapter(registry())(recipe());
 const forged={...plan,packagePins:[{...plan.packagePins[0],methodId:'other-method'}]};
 await assert.rejects(composer()(forged,methods),reject('SOURCE_PIN'));
});
test('composer rejects a snapshot-only plan that drops package pin evidence',async()=>{
 const {plan,methods}=createRecipeAdapter(registry())(recipe());
 const forged={...plan};delete forged.packagePins;
 await assert.rejects(composer()(forged,methods),reject('SOURCE_PIN'));
});
test('an unknown snapshot field cannot leak into a canonical package',()=>{
 const r=recipe();r.source_snapshot.user_admin=true;
 assert.throws(()=>createRecipeAdapter(registry())(r),reject('SOURCE_SNAPSHOT'));
});
test('independently valid hashes must still bind method text to full package bytes',()=>{
 const c=registry(),m=c.components[0].method;
 m.methodText='Different procedure with its own valid digest.';
 m.sha256=SHA(Buffer.from(m.methodText));
 assert.throws(()=>createRecipeAdapter(c),reject('SOURCE_TEXT_UNBOUND'));
});

test('public recipe to signed evidence to Prism interface to sealed disk package replays exactly',async()=>{
 const now=1784419200,{privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pem=publicKey.export({type:'spki',format:'pem'}).toString('utf8');
 const keySha=SHA(publicKey.export({type:'spki',format:'der'}));
 const evidence=Object.fromEntries(['evidence','rights','authority','coverage']
   .map(k=>[k,Buffer.from('independently checked FIXTURE for '+k)]));
 const evidenceDigests=Object.fromEntries(Object.entries(evidence).map(([k,b])=>[k,SHA(b)]));
 const seen=[];
 const trustedAssertions=createSignedAssertionAdapter({
  trust:{schema:'qortara/method-assertion-trust/1',issuer:'fixture.owner',
   keyId:'fixture-key-01',publicKeyPem:pem,publicKeySha256:keySha,policyRevision:'fixture.v1',
   revocations:{validFrom:now-100,expiresAt:now+100,proofDigests:[]}},
  loadEnvelope:async subjectSha256=>{
   seen.push(subjectSha256);
   const payload={schema:'qortara/method-assertion/1',subjectSha256,
     issuer:'fixture.owner',keyId:'fixture-key-01',policyRevision:'fixture.v1',
     validFrom:now-30,expiresAt:now+30,
     facts:{evidence:true,rights:true,authority:true,coverage:true},evidenceDigests};
   return {schema:'qortara/signed-method-assertion/1',payload,
    signature:signEd25519(null,Buffer.from('QORTARA-METHOD-ASSERTION-V1\n'+canonicalJSON(payload)),
     privateKey).toString('base64url')};
  },
  readEvidence:async({field})=>evidence[field],nowEpoch:()=>now
 });
 const adapt=createRecipeAdapter(registry());
 const {plan,methods}=adapt(recipe());
 const build=createComposer({assertMethod:trustedAssertions,runPrism:guest,holoSha256:HOLO});
 const root=await mkdtemp(join(tmpdir(),'skill-mason-pilot-fixture-'));
 try{
  const first=await build(plan,methods),dest=join(root,'candidate');
  await writePackage(first,dest);
  const restored=await readPackage(dest);
  assert.deepEqual(restored,first);
  const inputs=JSON.parse(restored.files['SOURCES.json']);
  const receipt=JSON.parse(restored.files['RECEIPT.json']);
  assert.equal(inputs.sourceSnapshot.sha256,SOURCE.sha256);
  assert.equal(receipt.assertions.length,1);
  assert.equal(receipt.assertions[0].subjectSha256,seen[0]);
  assert.equal(receipt.productionEligible,false);
  assert.equal(receipt.hostValidated,false);
  assert.equal(receipt.modelCallsMeasured,false);
  assert.deepEqual(first,await build(plan,methods));
 }finally{await rm(root,{recursive:true,force:true});}
});
