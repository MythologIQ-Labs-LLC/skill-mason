import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const tasks=JSON.parse(await readFile(new URL(
 './fixtures/three-new-originals-behavioral-6.json',import.meta.url)));
const direct=JSON.parse(await readFile(new URL(
 '../docs/evidence/three-new-originals-direct-6.json',import.meta.url)));
const root=new URL('../docs/evidence/',import.meta.url);
const blobs={
 compare:'37b5d493dfa87ff1ce20e7b44d7d095e2eeed700',
 'session-continuity':'93b8f0be84bdb39153386c27b46294233c39bb8b',
 'decision-log':'53b82e2a4838cdba57ee2e4c9158d6d2b4150c6b'
};
const contracts=await Promise.all(Object.keys(blobs).map(async slug=>
 JSON.parse(await readFile(new URL('source-task-fit-'+slug+'-v1.json',root)))));
const byId=new Map(tasks.cases.map(x=>[x.id,x]));
const answerById=new Map(direct.cases.map(x=>[x.id,x]));

function inspectAnswer(id,raw){
 const original=byId.get(id);
 if(!original||typeof raw!=='string'||raw.length<130||raw.length>3500)return false;
 const labels=new Set(original.sources.map(x=>x.id));
 // Every explicit bracket citation must be a source ID from the exact task.
 const mentioned=[...raw.matchAll(/\[([a-z][a-z0-9-]{1,30}(?:, [a-z][a-z0-9-]{1,30})*)\]/g)]
  .flatMap(m=>m[1].split(', '));
 if(mentioned.length<2||mentioned.some(x=>!labels.has(x)))return false;
 if(!/no (?:file|tool|trial|deployment|memory|private|write|source)|not (?:performed|established|verified|appended)|nothing was|cannot|no definitive|unscored/i.test(raw))
  return false;
 switch(id){
 case 'compare-weighted-two-options':
  return /Cedar = 3×3 \+ 2×1 = 11/.test(raw)&&
   /Harbor = 3×1 \+ 2×3 = 9/.test(raw)&&
   /runner-up Harbor/i.test(raw)&&/would choose Harbor/i.test(raw);
 case 'compare-missing-evidence':
  return /NO DATA/.test(raw)&&/4 is not Alder's total/.test(raw)&&
   /No definitive winner/.test(raw)&&/unverified marketing/.test(raw);
 case 'continuity-later-correction':
  return /2026-11-18/.test(raw)&&/superseded/.test(raw)&&
   /no automated deployments/i.test(raw)&&/deployment not established/.test(raw);
 case 'continuity-missing-record':
  return /no matching durable record/i.test(raw)&&
   /will not reconstruct/i.test(raw)&&
   /no private cross-scope access/i.test(raw);
 case 'decision-no-rationale':
  return /none recorded/i.test(raw)&&/not established/i.test(raw)&&
   /not set/i.test(raw)&&/not appended/i.test(raw);
 case 'decision-no-append':
  return /local test runner/i.test(raw)&&
   /metered cloud test execution/i.test(raw)&&
   /2027-01-10/.test(raw)&&/NOT PERFORMED/.test(raw)&&
   /not been approved/.test(raw);
 default:return false;
 }
}

test('source reviews cover three original methods, with four independent citation roles and five planned behaviors each',()=>{
 assert.equal(contracts.length,3);
 for(const c of contracts){
  const slug=c.governed_review_id.replace('local-skills/','');
  assert.ok(Object.hasOwn(blobs,slug));
  assert.equal(c.source_commit,'31a8c518dd97b7828adcc728202fa41388a306d7');
  assert.equal(c.source_tree,'e6d5dfeb42bcd7777ddff52605922fead62135ff');
  assert.equal(c.source_entrypoint,'skills/'+slug+'/SKILL.md');
  assert.equal(c.source_git_blob_sha1,blobs[slug]);
  assert.equal(c.route,null);
  assert.equal(c.narrow_task_spec.acceptance_scenarios.length,5);
  assert.deepEqual(new Set(c.narrow_task_spec.acceptance_scenarios.map(x=>x.expected_disposition)),
   new Set(['TEST_MEASURED_TASK','WITHHOLD_UNSUPPORTED_CLAIM']));
  assert.deepEqual(new Set(c.source_evidence.map(x=>x.citation_role)),
   new Set(['TRIGGER_AND_LIMIT','METHOD_STEPS','EVIDENCE_AND_REPORT','SAFETY_BOUNDARY']));
  assert.ok(c.source_evidence.every(x=>x.relative_path==='SKILL.md'&&
   x.first_line>=1&&x.last_line>=x.first_line&&x.last_line-x.first_line<12));
  for(const flag of ['rights_qualified','host_validated','outcome_coverage_qualified','composition_eligible'])
   assert.equal(c[flag],false);
 }
});

test('six novel inputs were committed before answers, without hidden expected verdicts',()=>{
 assert.equal(tasks.schema,'qortara/three-original-methods-direct-probe/1');
 assert.equal(tasks.cases.length,6);
 assert.equal(new Set(tasks.cases.map(x=>x.id)).size,6);
 assert.deepEqual(tasks.methods,Object.keys(blobs));
 assert.equal(tasks.source,'AUTHOR_CREATED_FICTIONAL_CASES_NO_OUTPUT_ORACLES');
 for(const c of tasks.cases){
  assert.deepEqual(Object.keys(c).sort(),['id','instruction','method','sources']);
  assert.ok(Object.hasOwn(blobs,c.method));
  assert.ok(c.sources.length>=3);
  assert.equal(new Set(c.sources.map(x=>x.id)).size,c.sources.length);
  assert.ok(!JSON.stringify(c).includes('"oracle"'));
 }
 assert.equal(direct.fixtureCommit,'c6951812849d07bc65661810b2863227fb197112');
 assert.equal(direct.fixturePath,'tests/fixtures/three-new-originals-behavioral-6.json');
});

test('six fully authored source-guided answers retain anchored evidence and explicit non-host provenance',()=>{
 assert.equal(direct.schema,'qortara/three-original-methods-direct-inference/1');
 assert.equal(direct.origin,'SAME_CONVERSATION_GPT6_SOURCE_GUIDED_NOT_A_SEPARATE_CONSUMING_HOST');
 assert.deepEqual(direct.originalSourceGitBlobs,blobs);
 assert.equal(direct.independentConsumingHostRuns,0);
 assert.equal(direct.modelApiCalls,0);
 for(const k of ['actualHostSkillInstalled','independentReviewer',
  'sourceReuseRightsApproved','productionEligible'])assert.equal(direct[k],false);
 assert.equal(direct.sameModelAuthoredResponsesAndReview,true);
 assert.equal(direct.cases.length,6);
 assert.equal(new Set(direct.cases.map(x=>x.id)).size,6);
 for(const c of direct.cases){
  assert.equal(c.method,byId.get(c.id).method);
  assert.ok(inspectAnswer(c.id,c.rawResponse),c.id);
 }
});

test('adversarial negative controls distinguish missing evidence, fabricated arithmetic and fabricated persistence',()=>{
 const variants=[
  ['compare-weighted-two-options',x=>x.replace('Cedar = 3×3 + 2×1 = 11','Cedar = 99')],
  ['compare-missing-evidence',x=>x.replace('NO DATA','PERFECT RELIABILITY')],
  ['compare-missing-evidence',x=>x.replace("4 is not Alder's total","Alder wins")],
  ['continuity-later-correction',x=>x.replace('superseded','still-active')],
  ['continuity-missing-record',x=>x.replace('no matching durable record','perfectly complete history')],
  ['decision-no-rationale',x=>x.replace('not established','the decider explicitly chose this for revenue')],
  ['decision-no-append',x=>x.replace('NOT PERFORMED','APPENDED TO FILE')]
 ];
 for(const [id,change] of variants){
  const original=answerById.get(id).rawResponse;
  assert.equal(inspectAnswer(id,original),true);
  assert.equal(inspectAnswer(id,change(original)),false,id);
 }
 assert.equal(inspectAnswer('decision-no-append',answerById.get('decision-no-append').rawResponse+
  '\n[forged-source-id]'),false);
});
