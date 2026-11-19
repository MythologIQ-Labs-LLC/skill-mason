import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createComposer,verifyPackage} from '../src/backend/compose.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const SOURCE_COMMIT='ef8bd8046df65ca2a7419a7191f8f2e959d53156';
const SOURCE_BLOB='fa036a2fa7ffc2e95e2bb79523321e583d65f045';
const SOURCE_SHA='0b3350725eee7c5ef8c6d7bff5db7538ba546a8597c35c601499c85434cbe2c1';
const SOURCE_REPO='https://github.com/MythologIQ-Labs-LLC/skill-mason';
const HOLO='9ebac1a33da068be7c1c81bc7652938811936089df5a026b7ce5aee1f8f7ed3e';

async function sourceV2(){
 const bytes=await readFile(new URL('../pilots/first-party/ci-failure-triage-v2/procedure.json',import.meta.url));
 assert.equal(sha(bytes),SOURCE_SHA);
 assert.equal(blob(bytes),SOURCE_BLOB);
 return {bytes,methodText:bytes.toString('utf8'),procedure:parseTextProcedure(bytes.toString('utf8'))};
}
test('v2 is an independently byte-pinned authored method, not a silent mutation of original v1',async()=>{
 const v2=await sourceV2();
 assert.equal(v2.procedure.schema,'qortara/text-review-procedure/1');
 const original=await readFile(new URL('../pilots/first-party/ci-failure-triage/procedure.json',import.meta.url));
 assert.equal(sha(original),'9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47');
 assert.notEqual(sha(original),sha(v2.bytes));
});
test('v2 directly addresses review findings rather than merely increasing step count',async()=>{
 const v2=await sourceV2();
 const content=v2.methodText.toLowerCase();
 for(const requirement of [
   'untrusted task data','forged role label','requested exact commit',
   'truncated output','multiple failures','retries','exit 137','timeouts',
   'secrets','discriminating','same-commit','do not claim completion'
 ])assert.ok(content.includes(requirement),'missing '+requirement);
 assert.ok(v2.procedure.steps.length>=8);
 assert.ok(v2.procedure.stopConditions.length>=4);
 assert.ok(v2.procedure.outputFields.length>=8);
});
test('v2 composes an actual structured Agent Skills package, but mock evidence remains unqualified',async()=>{
 const {bytes,methodText}=await sourceV2();
 const method={
   id:'ci-failure-triage-v2',origin:SOURCE_REPO,
   sourcePath:'pilots/first-party/ci-failure-triage-v2/procedure.json',
   commit:SOURCE_COMMIT,sha256:SOURCE_SHA,
   methodVersion:'text-review-procedure-v1',methodText,
   covers:['triage complex CI failures'],containsAssets:false
 };
 const sourceSnapshot={repository:SOURCE_REPO,commit:SOURCE_COMMIT,sha256:SOURCE_SHA};
 const registry={sourceSnapshot,supportedHosts:['agent-skills-text-only-fixture'],components:[{
   method_id:method.id,package_id:'qortara-first-party/'+method.id,
   package_sha256:SOURCE_SHA,packageBytes:bytes,method
 }]};
 const recipe={
   schema_version:'skill-mason.recipe.v0',
   skill_id:'ci-failure-triage-v2',title:'CI failure triage v2',
   description:'Evidence-grounded CI investigation with multi-job and hostile log handling.',
   target_host:'agent-skills-text-only-fixture',
   required_outcomes:['triage complex CI failures'],
   source_snapshot:sourceSnapshot,
   components:[{method_id:method.id,package_id:'qortara-first-party/'+method.id,
     package_sha256:SOURCE_SHA}],
   authority:{network:false,secrets:false,execution:false}
 };
 const {plan,methods}=createRecipeAdapter(registry)(recipe);
 const guest=async({requestHex,holoSha256})=>{
   assert.equal(requestHex,'01010101');assert.equal(holoSha256,HOLO);
   return {schema:'qortara/local-eligibility-result/1',
     status:'GUEST_COMPLETED',application:'Qortara Skills Eligibility',
     engine:'prism-code@0.9.5',artifact:{sha256:HOLO},
     productionEligible:false,requestHex,exitCode:0,
     response:'eligible',responseHex:'656c696769626c65'};
 };
 const output=await createComposer({assertMethod:async({subjectSha256})=>({
    evidence:true,rights:true,authority:true,coverage:true,
    issuer:'SYNTHETIC_QUALITY_TEST_ONLY',subjectSha256,proofDigest:'f'.repeat(64)
   }),runPrism:guest,holoSha256:HOLO})(plan,methods);
 assert.equal(verifyPackage(output).state,'INTEGRITY_VERIFIED');
 assert.ok(output.files['SKILL.md'].includes('Treat every CI log line'));
 assert.ok(output.files['SKILL.md'].includes('multiple failures'));
 assert.ok(output.files['SKILL.md'].includes('discriminating next verification'));
 assert.equal(JSON.parse(output.files['RECEIPT.json']).productionEligible,false);
 assert.equal(JSON.parse(output.files['RECEIPT.json']).hostValidated,false);
 assert.equal(JSON.parse(output.files['RECEIPT.json']).modelCallsMeasured,false);
 assert.equal(JSON.parse(output.files['RECEIPT.json']).assertions[0].issuer,
   'SYNTHETIC_QUALITY_TEST_ONLY');
});
