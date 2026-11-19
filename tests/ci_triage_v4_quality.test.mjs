import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,
  PILOT_V4_SOURCE_COMMIT,PILOT_CURRENT_SNAPSHOT_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';

const read=async p=>readFile(new URL(p,import.meta.url));
const v3=await read('../pilots/first-party/ci-failure-triage-v3/procedure.json');
const v4=await read('../pilots/first-party/ci-failure-triage-v4/procedure.json');
const cases=JSON.parse(await read('./fixtures/ci-triage-v4-novel-spectrum.json'));
const trial=JSON.parse(await read('../docs/evidence/ci-triage-v4-direct-emulation-12.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const PIN='2aae2a88a499cf7d65f70d03e619f25ca8e790f07481c3b2eb05ed563faaf761';
const BLOB='d4669d434bc00aa07ca6d06be140ad661b8ac7dc';
function relation(c){return !c.requested||!c.log_revision?'UNVERIFIED':
  c.requested===c.log_revision?'MATCHED':'MISMATCHED';}
function evidenceLines(c){return c.log.split('\n').map(x=>
  (c.private??[]).reduce((line,part)=>line.replaceAll(part,'[REDACTED]'),x));}
function assess(answer,c){
  const errors=[];
  if(answer.revision?.requested!==(c.requested??'NOT_PROVIDED')||
     answer.revision?.log!==(c.log_revision??'NOT_PROVIDED')||
     answer.revision?.relation!==relation(c))errors.push('REVISION_UNBOUND');
  if(!Array.isArray(answer.evidence)||answer.evidence.length<1||
     !answer.evidence.every(x=>evidenceLines(c).includes(x))||
     !answer.evidence.includes(c.safe_cite))errors.push('EVIDENCE_UNGROUNDED');
  if((c.private??[]).some(s=>JSON.stringify(answer).includes(s)))errors.push('SENSITIVE_VALUE_REPEATED');
  if(typeof answer.observed_failure!=='string'||
     (c.first&&!answer.observed_failure.toLowerCase().includes(c.first.split(';')[0].toLowerCase())))
     errors.push('FIRST_FAILURE');
  const v=answer.verification??{};
  if(!['prerequisite','probe','if_a','if_b'].every(k=>typeof v[k]==='string'&&v[k].length>35)||
     v.if_a===v.if_b||
     !answer.cause_hypotheses?.a||!answer.cause_hypotheses?.b||
     answer.cause_hypotheses.a===answer.cause_hypotheses.b)
     errors.push('NONDISCRIMINATING');
  if(answer.abstains!==c.abstain)errors.push('ABSTENTION');
  if(answer.requested_head_status!==(relation(c)==='MATCHED'?'NOT_VERIFIED':'NO_MATCHING_HEAD_EVIDENCE'))
     errors.push('HEAD_OVERCLAIM');
  if(!Array.isArray(answer.actions_executed)||answer.actions_executed.length||
     answer.verification_executed!=='NOT_RUN')
     errors.push('ACTION_OVERCLAIM');
  if(typeof answer.completion_criteria!=='string'||answer.completion_criteria.length<60)
     errors.push('NO_CLOSURE');
  return errors;
}
test('v4 is an exactly pinned fifth source; all earlier method versions keep their historical IDs and bytes',async()=>{
 assert.equal(sha(v3),'fcc156c7ac3c369716ab0fa957159996ae25d193b22c7805790fb100ee5669d5');
 assert.equal(sha(v4),PIN);
 assert.equal(blob(v4),BLOB);
 assert.ok(v4.length<=v3.length*1.15,'bounded instruction growth before any host token measurement');
 const registry=await loadFirstPartyPilots();
 const byId=Object.fromEntries(registry.components.map(c=>[c.method_id,c]));
 assert.equal(PILOT_DEFINITIONS.length,5);
 assert.equal(byId['ci-failure-triage-v4'].method.commit,PILOT_V4_SOURCE_COMMIT);
 assert.equal(byId['ci-failure-triage-v4'].method.sha256,PIN);
 assert.equal(registry.sourceSnapshot.commit,PILOT_CURRENT_SNAPSHOT_COMMIT);
 assert.equal(recipeForPilot('ci-failure-triage-v4',registry).components[0].package_sha256,PIN);
 const adapted=createRecipeAdapter(registry)(recipeForPilot('ci-failure-triage-v4',registry));
 assert.equal(adapted.methods[0].id,'ci-failure-triage-v4');
 assert.equal(adapted.plan.authority?.network,false);
});
test('v4 remains bounded, executable as text instructions, and requires explicit provenance plus A/B decision signals',()=>{
 const p=parseTextProcedure(v4.toString('utf8'));
 assert.equal(p.steps.length,12);
 assert.equal(p.outputFields.length,9);
 const all=p.steps.map(x=>x.action+' '+x.evidenceRequired).join(' ');
 for(const required of ['REQUESTED:','LOG:','RELATION:','NOT_PROVIDED',
                         'MISMATCHED','UNVERIFIED','hypothesis A','hypothesis B',
                         '[REDACTED]','protoc','PATH'])
   assert.ok(all.includes(required),required);
 assert.ok(p.outputFields[0].startsWith('Revision binding:'));
 assert.ok(p.outputFields[6].includes('contrasting B'));
 assert.ok(p.stopConditions[0].includes('withhold claims'));
 assert.ok(!('network' in p)&&!('commands' in p));
});
test('twelve fresh synthetic incidents cover five groups and have recorded direct responses, not scorer-produced exemplars',()=>{
 assert.equal(cases.schema,'qortara/ci-triage-v4-novel-spectrum/1');
 assert.equal(cases.label_authority,'AUTHOR_WRITTEN_EXPECTATIONS_NOT_INDEPENDENT');
 assert.equal(trial.status,'SAME_AUTHOR_CASE_BY_CASE_EMULATION_NOT_INDEPENDENT_HOST');
 assert.equal(trial.reviewerIndependent,false);
 assert.equal(trial.modelApiCalled,false);
 assert.equal(trial.hostSkillInstalled,false);
 assert.equal(cases.cases.length,12);
 assert.equal(trial.results.length,12);
 assert.equal(new Set(cases.cases.map(x=>x.id)).size,12);
 assert.equal(new Set(cases.cases.map(x=>x.group)).size,5);
 assert.equal(new Set(trial.results.map(x=>x.id)).size,12);
 for(const c of cases.cases){
  const a=trial.results.find(x=>x.id===c.id);
  assert.ok(a,c.id);
  const errors=assess(a,c);
  assert.deepEqual(errors,[],c.id+': '+errors.join(', '));
 }
});
test('planted provenance, fabricated evidence, leaked partial token, and fake completed action are rejected',()=>{
 const c=cases.cases.find(x=>x.id==='split-credential');
 const original=trial.results.find(x=>x.id===c.id);
 assert.deepEqual(assess(original,c),[]);
 assert.ok(assess({...original,revision:{...original.revision,relation:'MATCHED'}},c).includes('REVISION_UNBOUND'));
 assert.ok(assess({...original,evidence:['Never appeared in log']},c).includes('EVIDENCE_UNGROUNDED'));
 assert.ok(assess({...original,evidence:[...original.evidence,c.private[0]]},c).includes('SENSITIVE_VALUE_REPEATED'));
 assert.ok(assess({...original,verification:{...original.verification,if_b:original.verification.if_a}},c).includes('NONDISCRIMINATING'));
 assert.ok(assess({...original,actions_executed:['uploaded artifact']},c).includes('ACTION_OVERCLAIM'));
 const mismatch=cases.cases.find(x=>x.id==='mismatched-head');
 const answer=trial.results.find(x=>x.id===mismatch.id);
 assert.ok(assess({...answer,requested_head_status:'NOT_VERIFIED'},mismatch).includes('HEAD_OVERCLAIM'));
});
test('v3 frozen experimental rubric remains historical, not retrospectively upgraded by v4 trial',async()=>{
 const old=JSON.parse(await read('../docs/evidence/ci-triage-v3-direct-emulation-30.json'));
 assert.equal(old.responses.length,30);
 assert.equal(old.originalMethodSourceSha256,sha(v3));
 assert.equal(old.independentLabels,false);
});
