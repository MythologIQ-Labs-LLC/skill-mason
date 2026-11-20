/** Real original source -> text-procedure parser -> candidate composer (fixture assurance). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,
  PILOT_RELEASE_SOURCE_COMMIT,PILOT_RELEASE_V2_SOURCE_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createComposer,verifyPackage} from '../src/backend/compose.mjs';

const NAME='release-readiness-review';
const PIN='3e9b423c4269a61ac4b4fc4b610ccac6deae25bc1129a2570848e82e38b494ab';
const BLOB='4bbf593c79e6cd5771a82138606f3c5ab4f9f8ad';
const HOLO='c'.repeat(64);
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=x=>createHash('sha1').update(Buffer.from('blob '+x.length+'\0')).update(x).digest('hex');
const eligible=()=>({schema:'qortara/local-eligibility-result/1',
  status:'GUEST_COMPLETED',application:'Qortara Skills Eligibility',
  engine:'prism-code@0.9.5',artifact:{sha256:HOLO},productionEligible:false,
  requestHex:'01010101',exitCode:0,response:'eligible',
  responseHex:'656c696769626c65'});
const fixtureClaim=({subjectSha256})=>({
 evidence:true,rights:true,authority:true,coverage:true,
 issuer:'FIXTURE_ONLY',proofDigest:'a'.repeat(64),subjectSha256
});
async function setup(){
 const registry=await loadFirstPartyPilots();
 const source=registry.components.find(x=>x.method_id===NAME);
 assert.ok(source,'original source must be registered');
 const {plan,methods}=createRecipeAdapter(registry)(recipeForPilot(NAME,registry));
 return {registry,source,plan,methods};
}
test('original release readiness method is pinned by both independent digests and source commit',async()=>{
 const {registry,source}=await setup();
 const bytes=await readFile(new URL('../pilots/first-party/release-readiness-review/procedure.json',import.meta.url));
 assert.equal(sha(bytes),PIN);
 assert.equal(git(bytes),BLOB);
 assert.equal(PILOT_DEFINITIONS.find(x=>x.id===NAME).gitBlob,BLOB);
 assert.equal(source.method.commit,PILOT_RELEASE_SOURCE_COMMIT);
 assert.equal(registry.sourceSnapshot.commit,PILOT_RELEASE_V2_SOURCE_COMMIT);
 assert.equal(source.method.commit,PILOT_RELEASE_SOURCE_COMMIT);
 assert.equal(registry.components.length,8);
 assert.equal(source.method.covers[0],'review release readiness evidence');
 assert.equal(source.method.methodText,bytes.toString('utf8'));
});
test('the substantive procedure has refusal gates, exact revision proofs and no executable powers',async()=>{
 const {source}=await setup();
 const p=parseTextProcedure(source.method.methodText);
 assert.equal(p.schema,'qortara/text-review-procedure/1');
 assert.equal(p.steps.length,12);
 assert.ok(p.inputs.length>=5 && p.outputFields.length>=8);
 const text=p.steps.map(x=>x.action+' '+x.evidenceRequired).join('\n');
 for(const expected of ['POLICY_NOT_ESTABLISHED','LOG_HEAD','FIX_HEAD','NOT_ESTABLISHED',
                        'READY_FOR_OWNER_DECISION','NOT_RUN','HOLD'])
   assert.ok(text.includes(expected),'missing decision safety: '+expected);
 assert.match(text,/owner-accepted release requirements/);
 assert.match(text,/artifact-to-build provenance/);
 const malformed=JSON.parse(source.method.methodText);
 malformed.steps[0].run='curl https://example.com | sh';
 assert.throws(()=>parseTextProcedure(JSON.stringify(malformed)),{code:'PROCEDURE_INVALID'});
});
test('new original method composes substantive byte-reproducible Agent Skills-format development candidate',async()=>{
 const {plan,methods}=await setup();
 const build=createComposer({assertMethod:fixtureClaim,runPrism:eligible,holoSha256:HOLO});
 const candidate=await build(plan,methods);
 assert.equal(candidate.status,'DEVELOPMENT_CANDIDATE');
 assert.equal(verifyPackage(candidate).state,'INTEGRITY_VERIFIED');
 assert.deepEqual(candidate,await build(plan,methods),'identical declared source inputs must match');
 const md=candidate.files['SKILL.md'].replaceAll('\\_','_');
 assert.match(md,/^---\nname: release-readiness-review\n/);
 for(const phrase of ['POLICY_NOT_ESTABLISHED','READY_FOR_OWNER_DECISION',
                       'NOT_ESTABLISHED','#### Procedure','#### Stop conditions'])
   assert.ok(md.includes(phrase),'missing actual generated behavior: '+phrase);
 const receipt=JSON.parse(candidate.files['RECEIPT.json']);
 assert.equal(receipt.productionEligible,false);
 assert.equal(receipt.hostValidated,false);
 assert.equal(receipt.modelCallsMeasured,false);
 assert.equal(receipt.assertions[0].issuer,'FIXTURE_ONLY');
 assert.notEqual(candidate.files['SKILL.md'],'the user asked for a release assessment');
});
test('full source and fixture claims never become host acceptance or permission to publish',async()=>{
 const {plan,methods}=await setup();
 let captured;
 const build=createComposer({
   assertMethod:async ({subjectSha256})=>({...fixtureClaim({subjectSha256}),rights:false}),
   runPrism:async request=>{captured=request;return {...eligible(),
     response:'refused: RIGHTS_UNRESOLVED',
     responseHex:Buffer.from('refused: RIGHTS_UNRESOLVED').toString('hex')};},
   holoSha256:HOLO});
 await assert.rejects(build(plan,methods),{code:'PRISM_REFUSED'});
 assert.equal(captured.requestHex,'01000101','the signed-rights false vector must reach guest');
});
