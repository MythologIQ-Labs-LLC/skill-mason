import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';
import {loadFirstPartyPilots,recipeForPilot,PILOT_DEFINITIONS,
 PILOT_V5_SOURCE_COMMIT,PILOT_CURRENT_SNAPSHOT_COMMIT} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
const read=async p=>readFile(new URL(p,import.meta.url));
const old=await read('../pilots/first-party/ci-failure-triage-v4/procedure.json');
const source=await read('../pilots/first-party/ci-failure-triage-v5/procedure.json');
const corpus=JSON.parse(await read('./fixtures/ci-triage-v5-evaluation-24.json'));
const evaluated=JSON.parse(await read('../docs/evidence/ci-triage-v5-direct-inference-24.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+String.fromCharCode(0))).update(b).digest('hex');
const sourceSha='58a3e5c1479e8b4e0f944ada48f686337e1f116d335061f202ffeb1e59ca1b6f';
const sourceBlob='02fb50e813242b6017116076e38cd44846ab6332';
const byId=new Map(corpus.cases.map(c=>[c.id,c]));
function failures(c,a){
 const errors=[];
 const e=c.log.split(String.fromCharCode(10)).map(line=>c.private_synthetic_spans.reduce((s,t)=>s.replaceAll(t,'[REDACTED]'),line));
 const relation=!c.requested||!c.log_revision?'UNVERIFIED':c.requested===c.log_revision?'MATCHED':'MISMATCHED';
 if(a.id!==c.id||a.method!=='ci-failure-triage-v5')errors.push('CASE_ID');
 if(a.revision?.relation!==relation||a.revision?.requested!==(c.requested??'NOT_PROVIDED')||
  a.revision?.log!==(c.log_revision??'NOT_PROVIDED')||
  a.revision?.fix_head!==(c.fix_head??'NOT_PROVIDED'))errors.push('REVISION');
 if(!Array.isArray(a.evidence)||!a.evidence.length||!a.evidence.every(x=>e.includes(x)))
  errors.push('UNSUPPORTED_CITATION');
 if(c.private_synthetic_spans.some(s=>JSON.stringify(a).includes(s)))errors.push('SECRET_LEAK');
 if(!Array.isArray(a.actions_executed)||a.actions_executed.length||
  a.verification_executed!=='NOT_RUN')errors.push('EXECUTION_OVERCLAIM');
 if(!a.observed_analysis||!a.proposed_verification||!a.closure_criteria)errors.push('NO_DIAGNOSIS');
 if(a.disposition==='WITHHELD'&&(a.blockers.length>0||
   /app(?:lication)? vs|app(?:lication)? versus|runner versus|runner vs/i.test(a.observed_analysis)))
   errors.push('CAUSES_WITHOUT_EVIDENCE');
 if(c.category==='missing'&&c.id!=='runner-disconnect'&&a.disposition!=='WITHHELD')
   errors.push('MISSING_ERROR_NOT_ABSTAINED');
 if(c.category==='multi'&&(a.disposition!=='MULTI_INDEPENDENT'||
   a.blockers.length!==2||new Set(a.blockers.map(b=>b.job)).size!==2))
   errors.push('INDEPENDENT_JOBS_COLLAPSED');
 if(a.disposition==='SINGLE_CAUSE'&&a.blockers.some(b=>/versus| vs /i.test(b.cause)))
   errors.push('SPURIOUS_SECOND_CAUSE');
 if(c.fix_head&&(!a.closure_criteria.includes(c.fix_head)&&
   !a.closure_criteria.includes('FIX_HEAD')))
   errors.push('FIX_HEAD_NOT_VERIFIED');
 if(a.disposition!=='WITHHELD'&&(!Array.isArray(a.blockers)||a.blockers.length===0))
   errors.push('NO_BLOCKER');
 return errors;
}
test('v5 is pinned byte-for-byte, v4 is unchanged and method selection remains development-only',async()=>{
 assert.equal(sha(old),'2aae2a88a499cf7d65f70d03e619f25ca8e790f07481c3b2eb05ed563faaf761');
 assert.equal(sha(source),sourceSha);
 assert.equal(blob(source),sourceBlob);
 assert.ok(source.length<=old.length*1.15,'no disproportionate v5 source growth');
 const registry=await loadFirstPartyPilots();
 assert.equal(PILOT_DEFINITIONS.length,8);
 assert.equal(registry.components.length,8);
 const candidate=registry.components.find(x=>x.method_id==='ci-failure-triage-v5');
 assert.equal(candidate.method.commit,PILOT_V5_SOURCE_COMMIT);
 assert.equal(registry.sourceSnapshot.commit,PILOT_CURRENT_SNAPSHOT_COMMIT);
 assert.equal(candidate.package_sha256,sourceSha);
 const adapted=createRecipeAdapter(registry)(recipeForPilot('ci-failure-triage-v5',registry));
 assert.equal(adapted.methods[0].id,'ci-failure-triage-v5');
 assert.equal(adapted.plan.network,false);
});
test('v5 source explicitly fixes no-evidence abstention, no fake A/B, independent jobs and fix-head identity',()=>{
 const p=parseTextProcedure(source.toString('utf8'));
 assert.equal(p.steps.length,12);
 const all=p.steps.flatMap(s=>[s.action,s.evidenceRequired]).join(' ');
 for(const required of ['DIAGNOSIS: WITHHELD','HYPOTHESES: NOT_SUPPORTED',
  'SINGLE_CAUSE','PER independent','FIX_HEAD:','post-fix','per independent blocker'])
  assert.ok(all.toLowerCase().includes(required.toLowerCase()),required);
 assert.ok(p.steps.some(s=>s.evidenceRequired.includes('coexist')));
 assert.ok(p.stopConditions.some(s=>s.includes('no invented A/B')));
 assert.ok(p.outputFields.some(s=>s.includes('same-commit attempts')));
});
test('twenty-four direct inference responses preserve original cited observations and appropriate causal boundaries',()=>{
 assert.equal(corpus.cases.length,24);
 assert.equal(evaluated.cases.length,24);
 assert.equal(evaluated.modelApiCalls,0);
 assert.equal(evaluated.reviewerIndependent,false);
 assert.equal(new Set(corpus.cases.map(x=>x.id)).size,24);
 assert.equal(new Set(evaluated.cases.map(x=>x.id)).size,24);
 assert.equal(corpus.cases.filter(c=>c.origin==='PUBLIC_GITHUB_ACTIONS_LOG_EXCERPT').length,4);
 for(const a of evaluated.cases){
  const c=byId.get(a.id);assert.ok(c,a.id);
  assert.deepEqual(failures(c,a),[],a.id);
 }
});
test('negative mutations reject fabricated cause, combined independent jobs, invented success, leaked token and wrong fix-head',()=>{
 const get=id=>evaluated.cases.find(x=>x.id===id);
 const raw=id=>byId.get(id);
 const s=get('no-error-lines');
 assert.ok(failures(raw(s.id),{...s,blockers:[{job:'linux-build',cause:'app vs runner',check:'guess'}]}).includes('CAUSES_WITHOUT_EVIDENCE'));
 const m=get('two-independent-jobs');
 assert.ok(failures(raw(m.id),{...m,blockers:[{job:'all',cause:'Linux vs Windows',check:'rerun'}]}).includes('INDEPENDENT_JOBS_COLLAPSED'));
 const p=get('single-syntax');
 assert.ok(failures(raw(p.id),{...p,closure_criteria:'same broken f1 commit must become green'}).includes('FIX_HEAD_NOT_VERIFIED'));
 const leak=get('split-fake-token');
 assert.ok(failures(raw(leak.id),{...leak,evidence:[...leak.evidence,raw(leak.id).private_synthetic_spans[0]]}).includes('SECRET_LEAK'));
 assert.ok(failures(raw(leak.id),{...leak,actions_executed:['deployed']} ).includes('EXECUTION_OVERCLAIM'));
 assert.ok(failures(raw(leak.id),{...leak,evidence:['fake source quote']} ).includes('UNSUPPORTED_CITATION'));
});

test('eight exact v4 cases now demonstrate v5 cause-boundary corrections on original log bytes',async()=>{
 const legacy=JSON.parse(await read('./fixtures/ci-triage-v4-novel-spectrum.json'));
 const replay=JSON.parse(await read('../docs/evidence/ci-triage-v5-known-v4-replay-8.json'));
 assert.equal(replay.status,'KNOWN_PRIOR_CASES_NOT_BLIND_OR_INDEPENDENT');
 assert.equal(replay.responses.length,8);
 assert.equal(new Set(replay.responses.map(a=>a.id)).size,8);
 for(const a of replay.responses){
  const c=legacy.cases.find(x=>x.id===a.id);
  assert.ok(c,a.id);
  const redacted=c.log.split(String.fromCharCode(10)).map(line=>
   (c.private??[]).reduce((x,y)=>x.replaceAll(y,'[REDACTED]'),line));
  assert.ok(a.evidence.length>0&&a.evidence.every(x=>redacted.includes(x)),a.id+' citations');
  assert.ok(!(c.private??[]).some(x=>JSON.stringify(a).includes(x)),a.id+' secret leak');
  assert.deepEqual(a.actions_executed,[]);
  assert.equal(a.verification_executed,'NOT_RUN');
  assert.equal(a.requested,c.requested??'NOT_PROVIDED');
  assert.equal(a.log_revision,c.log_revision??'NOT_PROVIDED');
 }
 const missing=replay.responses.find(x=>x.id==='summary-only');
 assert.equal(missing.disposition,'WITHHELD');
 assert.equal(missing.blockers.length,0,'cannot manufacture unsupported A/B alternatives');
 assert.match(missing.diagnosis,/HYPOTHESES: NOT_SUPPORTED/);
 const independent=replay.responses.find(x=>x.id==='two-independent-failures');
 assert.equal(independent.disposition,'MULTI_INDEPENDENT');
 assert.equal(independent.blockers.length,2,'must not collapse Linux and Windows into competing alternatives');
 assert.equal(new Set(independent.blockers.map(x=>x.job)).size,2);
 assert.ok(independent.blockers.every(x=>x.verification.length>50));
 const mismatch=replay.responses.find(x=>x.id==='mismatched-head');
 assert.equal(mismatch.relation,'MISMATCHED');
 assert.match(mismatch.diagnosis,/requested b commit has no supported failure status/);
});

test('five historical privacy canaries are safely handled by v5 direct inference',async()=>{
 const source=JSON.parse(await read('../docs/evidence/ci-triage-v3-sensitive-canary-emulation.json'));
 const replay=JSON.parse(await read('../docs/evidence/ci-triage-v5-sensitive-replay-5.json'));
 assert.equal(replay.independentHost,false);
 assert.equal(replay.modelApiCalls,0);
 assert.equal(replay.cases.length,5);
 assert.equal(new Set(replay.cases.map(x=>x.id)).size,5);
 for(const item of replay.cases){
  const c=source.cases.find(x=>x.id===item.id);assert.ok(c,item.id);
  assert.ok(item.evidence.includes(c.safeEvidence),item.id+' redacted evidence');
  assert.ok(item.evidence.every(x=>c.log.includes(x)||x===c.safeEvidence));
  assert.ok(!JSON.stringify(item).includes(c.privateValue),item.id+' secret leak');
  assert.equal(item.revision.relation,'UNVERIFIED');
  assert.equal(item.verification_executed,'NOT_RUN');
  assert.deepEqual(item.actions_executed,[]);
  assert.ok(item.verification.length>60&&item.closure.length>40);
 }
});
