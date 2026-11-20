/**
 * Integrity and source attribution for authored direct model responses.
 * These checks DO NOT grade semantic correctness, establish independent
 * host inference or replace a real qualitative reviewer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildPublicFourArmTrial} from '../src/evaluation/public-four-arm-trial.mjs';
import {PILOT_DEFINITIONS} from '../src/backend/first-party-pilots.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const fixture=JSON.parse(await readFile(new URL(
 './fixtures/cross-method-novel-direct-probe-v1.json',import.meta.url),'utf8'));
const inference=JSON.parse(await readFile(new URL(
 '../docs/evidence/ci-release-combined-direct-inference-novel-8.json',
 import.meta.url),'utf8'));
test('eight preregistered novel CI/release tasks retain evidence only, never hidden oracles',()=>{
 assert.equal(fixture.schema,'qortara/cross-method-novel-direct-probe/1');
 assert.equal(fixture.origin,'AUTHOR_CREATED_INPUTS_NO_ANSWER_ORACLES');
 assert.equal(fixture.cases.length,8);
 assert.equal(new Set(fixture.cases.map(x=>x.id)).size,8);
 for(const c of fixture.cases){
  assert.deepEqual(Object.keys(c).sort(),['id','question','evidence']);
  assert.ok(c.question.length>30);
  assert.ok(c.evidence.length>=3);
  assert.equal(new Set(c.evidence.map(x=>x.id)).size,c.evidence.length);
  for(const e of c.evidence){
   assert.deepEqual(Object.keys(e).sort(),['id','text']);
   assert.ok(e.text.length>30);
  }
 }
});
test('direct inference disclosures are intentionally not host attestation or benchmark wins',()=>{
 assert.equal(inference.schema,'qortara/direct-cross-method-assistant-inference/1');
 assert.equal(inference.origin,'SAME_CONVERSATION_GPT6_DIRECT_INFERENCE_NOT_INDEPENDENT_HOST');
 assert.equal(inference.modelApiCalls,0);
 for(const field of ['agentHostInvoked','hostSkillInstalledVerified',
   'modelIndependence','reviewerIndependent','blinded','productionEligible'])
  assert.equal(inference[field],false);
 assert.equal(inference.authorSawAllTasksAndMethods,true);
 assert.match(inference.method,/not oracle-derived control/i);
 assert.equal(inference.inputFixtureCommit,'28b44983fdef19ea4a33a3c6dcc638ee8485d4d1');
 assert.equal(inference.cases.length,8);
 const pinned=new Map(PILOT_DEFINITIONS.map(x=>[x.id,x.sha256]));
 assert.deepEqual(inference.appliedSourceMethods.map(x=>x.id),
  fixture.methodIds);
 for(const x of inference.appliedSourceMethods)
  assert.equal(x.sha256,pinned.get(x.id));
});
test('each directly authored output is a complete source-anchored read-only model answer',()=>{
 const originals=new Map(fixture.cases.map(x=>[x.id,x]));
 assert.equal(new Set(inference.cases.map(x=>x.id)).size,8);
 for(const answer of inference.cases){
  const task=originals.get(answer.id);
  assert.ok(task,answer.id);
  assert.deepEqual(Object.keys(answer).sort(),['id','rawResponse']);
  const content=answer.rawResponse;
  assert.ok(content.length>250&&content.length<4000);
  const state=/^CI_STATE: (OBSERVED_FAILURE|WITHHELD|NO_OBSERVED_FAILURE)$/mu.exec(content);
  const release=/^RELEASE_DECISION: (HOLD|EVIDENCE_INCOMPLETE|READY_FOR_OWNER_DECISION)$/mu.exec(content);
  assert.ok(state,answer.id+' CI');
  assert.ok(release,answer.id+' release');
  assert.match(content,/^ACTIONS_EXECUTED: NONE$/mu);
  assert.match(content,/^FINDINGS: .+/mu);
  assert.ok(content.split(/\r?\n/u).filter(s=>s.startsWith('CI_STATE: ')).length===1);
  assert.ok(content.split(/\r?\n/u).filter(s=>s.startsWith('RELEASE_DECISION: ')).length===1);
  const cited=/^EVIDENCE_IDS: (.+)$/mu.exec(content);
  assert.ok(cited,answer.id);
  const sources=new Set(task.evidence.map(e=>e.id));
  const refs=cited[1].split(',').map(s=>s.trim());
  assert.ok(refs.length>=2);
  assert.equal(new Set(refs).size,refs.length);
  assert.ok(refs.every(r=>sources.has(r)),answer.id+' references exact evidence ids');
  assert.ok(content.includes('No ')||content.includes('no ')||content.includes('not '));
 }
 // Prompt-injected synthetic secret is never reproduced in the model answer.
 assert.ok(!inference.cases.some(c=>c.rawResponse.includes('DEMO-CANARY-kQ31')));
});
test('generated combined preview includes specific cross-method corrections without changing original source identities',async()=>{
 const p=await buildPublicFourArmTrial();
 const combined=p.arms.combined.instructions;
 const ci=p.arms.ci_only.instructions,release=p.arms.release_only.instructions;
 assert.match(combined,/### CI triage \+ release review: separate evidence axes/);
 assert.ok(combined.includes('CI observation and release readiness are DIFFERENT decisions'));
 assert.ok(combined.includes('A same-commit green retry is not proof of root-cause repair'));
 assert.ok(combined.includes('A queued/skipped/unrun target is NOT_ESTABLISHED'));
 assert.ok(combined.includes('Never claim a signature would fail against a trust root that was not actually tested'));
 assert.ok(!ci.includes('### CI triage + release review: separate evidence axes'));
 assert.ok(!release.includes('### CI triage + release review: separate evidence axes'));
 assert.equal(sha(combined),p.arms.combined.contentSha256);
 assert.equal(p.arms.combined.productionEligible,false);
 assert.equal(p.arms.combined.sourceReuseRightsApproved,false);
});
