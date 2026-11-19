import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,PILOT_SOURCE_COMMIT,
  PILOT_V2_SOURCE_COMMIT,PILOT_SNAPSHOT_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {bindFirstPartyRequest} from '../bin/request-first-party-pilot.mjs';

const SHA=b=>createHash('sha256').update(b).digest('hex');
const GIT_BLOB=b=>createHash('sha1').update(Buffer.from('blob '+b.length+String.fromCharCode(0))).update(b).digest('hex');
const V3_SOURCE='fcc156c7ac3c369716ab0fa957159996ae25d193b22c7805790fb100ee5669d5';
const V3_BLOB='020d6850472c9f3fad80c07a1b6d2a5af78c34c4';
const V1_SOURCE='9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47';
const V2_SOURCE='0b3350725eee7c5ef8c6d7bff5db7538ba546a8597c35c601499c85434cbe2c1';

test('original v1, v2 and new v3 source blobs remain independently pinned',async()=>{
  const sources=await Promise.all(['ci-failure-triage','ci-failure-triage-v2',
    'ci-failure-triage-v3'].map(x=>readFile(new URL('../pilots/first-party/'+x+'/procedure.json',import.meta.url))));
  assert.equal(SHA(sources[0]),V1_SOURCE);
  assert.equal(SHA(sources[1]),V2_SOURCE);
  assert.equal(SHA(sources[2]),V3_SOURCE);
  assert.equal(GIT_BLOB(sources[2]),V3_BLOB);
  assert.equal(PILOT_DEFINITIONS.length,6);
  const registry=await loadFirstPartyPilots();
  const byId=Object.fromEntries(registry.components.map(x=>[x.method_id,x]));
  assert.equal(byId['ci-failure-triage'].method.commit,PILOT_SOURCE_COMMIT);
  assert.equal(byId['ci-failure-triage-v2'].method.commit,PILOT_V2_SOURCE_COMMIT);
  assert.equal(byId['ci-failure-triage-v3'].method.commit,PILOT_SNAPSHOT_COMMIT);
  assert.equal(byId['ci-failure-triage-v3'].method.sha256,V3_SOURCE);
  const recipe=recipeForPilot('ci-failure-triage-v3',registry);
  assert.equal(createRecipeAdapter(registry)(recipe).methods[0].id,'ci-failure-triage-v3');
});

test('redaction explicitly overrides later exact evidence quote requirements',async()=>{
  const raw=await readFile(new URL('../pilots/first-party/ci-failure-triage-v3/procedure.json',import.meta.url),'utf8');
  const p=parseTextProcedure(raw);
  assert.equal(p.steps.length,12);
  assert.ok(p.steps[1].action.includes('Redact sensitive data before quoting'));
  assert.ok(p.steps[1].evidenceRequired.includes('[REDACTED]'));
  assert.ok(p.steps[1].evidenceRequired.includes('Authorization headers'));
  assert.ok(p.steps[1].evidenceRequired.includes('Never repeat the original value'));
  assert.ok(p.steps[2].action.includes('credential'));
  assert.ok(p.steps[2].evidenceRequired.includes('unproven external exposure'));
  const diagnosis=p.steps.find(x=>x.action.startsWith('For each independently failing job'));
  assert.ok(diagnosis.evidenceRequired.includes('[REDACTED]'));
  assert.ok(diagnosis.evidenceRequired.includes('never prioritize verbatim quotation over privacy'));
  assert.ok(p.outputFields.some(x=>x.includes('redact sensitive values')));
  assert.ok(p.stopConditions.some(x=>x.includes('never repeat it')));
  assert.ok(p.steps.at(-1).action.includes('safely redacted citations'));
});

test('v3 can only be selected explicitly for the sensitive-log request, never as implicit upgrade',()=>{
  const input='Analyze failing CI logs that contain token and authorization information while redacting the sensitive material.';
  const args={request:input,host:'agent-skills-text-only-fixture',
    capability:'triage sensitive CI failure logs',methodId:'ci-failure-triage-v3'};
  const bound=bindFirstPartyRequest(args);
  assert.equal(bound.methodId,'ci-failure-triage-v3');
  assert.equal(bound.admittedSourceRights,false);
  assert.equal(bound.requestSemanticMatchVerified,false);
  assert.throws(()=>bindFirstPartyRequest({...args,methodId:'ci-failure-triage-v2'}),
    {code:'METHOD_MISMATCH'});
});

test('redaction example does not promote raw credentials into the first-party method',async()=>{
  const raw=await readFile(new URL('../pilots/first-party/ci-failure-triage-v3/procedure.json',import.meta.url),'utf8');
  const p=parseTextProcedure(raw);
  const proceduralText=p.steps.map(x=>x.action+' '+x.evidenceRequired).join(' ');
  for(const risk of ['passwords','tokens','Authorization headers','signed URL secrets','personal identifiers'])
    assert.ok(proceduralText.includes(risk),risk);
  assert.ok(proceduralText.includes('Replace'));
  assert.ok(proceduralText.includes('[REDACTED]'));
  assert.ok(!proceduralText.includes('sk-test-EXAMPLE-SECRET'));
});
