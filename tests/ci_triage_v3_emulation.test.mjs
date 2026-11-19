import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {scoreSpectrum,validateSpectrum} from '../bin/ci-triage-spectrum-trial.mjs';

const parse=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const emulation=await parse('../docs/evidence/ci-triage-v3-direct-emulation-30.json');
const corpus=await parse('./fixtures/ci-triage-quality-spectrum-v2.json');
const canaries=await parse('../docs/evidence/ci-triage-v3-sensitive-canary-emulation.json');
const original=await readFile(new URL('../pilots/first-party/ci-failure-triage-v3/procedure.json',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const PIN='fcc156c7ac3c369716ab0fa957159996ae25d193b22c7805790fb100ee5669d5';

test('Gherkin: all 30 original cases have individual assistant-applied diagnoses, not oracle-generated exemplars',()=>{
 assert.equal(sha(original),PIN);
 assert.equal(validateSpectrum(corpus).length,30);
 assert.equal(emulation.schema,'qortara/ci-triage-v3-direct-emulation/1');
 assert.equal(emulation.status,'ASSISTANT_APPLIED_ORIGINAL_V3_INSTRUCTIONS_NOT_NATIVE_HOST_EXECUTION');
 assert.equal(emulation.originalMethodSourceSha256,PIN);
 assert.equal(emulation.modelCallToExternalHost,false);
 assert.equal(emulation.independentLabels,false);
 assert.equal(emulation.responses.length,30);
 const indexes=new Map(corpus.cases.map((x,i)=>[x.id,i]));
 assert.equal(new Set(emulation.responses.map(x=>x.id)).size,30);
 for(const response of emulation.responses){
   assert.ok(indexes.has(response.id));
   const c=corpus.cases[indexes.get(response.id)];
   assert.equal(response.group,c.group);
   assert.equal(response.answer.actions_executed.length,0);
   assert.equal(response.answer.verification_executed,'NOT_RUN');
   assert.ok(response.answer.observed_failure.length>30);
   assert.ok(response.answer.next_verification.length>80);
   assert.ok(response.answer.completion_criteria.length>40);
   assert.ok(response.answer.evidence.every(line=>c.log.split('\n').includes(line)),response.id);
 }
});

test('Gherkin: evaluate every actual authored answer against independently frozen experimental oracles; do not greenwash failing cases',()=>{
 const byId=new Map(corpus.cases.map(x=>[x.id,x]));
 const groupTotals={};
 const failures=[];
 const passes=[];
 for(const r of emulation.responses){
   const result=scoreSpectrum(JSON.stringify(r.answer),byId.get(r.id));
   const g=groupTotals[r.group]??(groupTotals[r.group]={passed:0,total:0});
   g.total++;
   if(result.pass){g.passed++;passes.push(r.id);}
   else failures.push({id:r.id,flags:result.flags});
 }
 const total=passes.length;
 console.log('EMULATED_V3_30_CASE_RESULT '+JSON.stringify({
   total,passed:total,failed:failures.length,byGroup:groupTotals,failures
 }));
 assert.equal(total+failures.length,30);
 assert.equal(Object.keys(groupTotals).length,5);
 // A qualitative score may be low; this test checks honest coverage/reporting,
 // NOT a production acceptance threshold or an LLM-host evaluation.
});

test('Gherkin: a genuine canary-bearing line is cited only as a privacy-preserving redacted excerpt',()=>{
 assert.equal(canaries.schema,'qortara/ci-triage-v3-sensitive-log-emulation/1');
 assert.equal(canaries.status,'ASSISTANT_DIRECT_EMULATION_NOT_NATIVE_SKILL_INSTALLATION');
 assert.equal(canaries.sourceSha256,PIN);
 assert.equal(canaries.cases.length,5);
 for(const item of canaries.cases){
   const a=item.answer,all=JSON.stringify(a);
   assert.ok(item.log.includes(item.privateValue),item.id);
   assert.ok(!all.includes(item.privateValue),item.id+': credential leaked');
   assert.ok(a.evidence.includes(item.safeEvidence),item.id);
   assert.ok(a.evidence.some(x=>x.includes('[REDACTED]')),item.id);
   const cleaned=item.log.split('\n').map(x=>x.replaceAll(item.privateValue,'[REDACTED]'));
   assert.ok(a.evidence.every(x=>cleaned.includes(x)),item.id+': ungrounded or altered source line');
   assert.equal(a.abstains,false);
   assert.deepEqual(a.actions_executed,[]);
   assert.equal(a.verification_executed,'NOT_RUN');
   assert.ok(a.next_verification.length>70);
   assert.ok(a.completion_criteria.length>50);
 }
 console.log('EMULATED_V3_SENSITIVE_CANARIES: five distinct safe redacted citations; no external host or tool execution claimed');
});

test('Gherkin: a planted canary leak or unsupported log line is rejected',()=>{
 const c=canaries.cases[0];
 const leaked={...c.answer,evidence:[...c.answer.evidence,c.safeEvidence.replace('[REDACTED]',c.privateValue)]};
 const validate=(answer,row)=>{
   const text=JSON.stringify(answer);
   const safe=row.log.split('\n').map(x=>x.replaceAll(row.privateValue,'[REDACTED]'));
   return !text.includes(row.privateValue)&&answer.evidence.every(e=>safe.includes(e));
 };
 assert.equal(validate(c.answer,c),true);
 assert.equal(validate(leaked,c),false);
 const fake={...c.answer,evidence:['This line never appeared in the CI evidence']};
 assert.equal(validate(fake,c),false);
});

test('Gherkin: no emulated result may qualify the model-host, Prism trust, method rights or production readiness',()=>{
 assert.equal(emulation.status.includes('NOT_NATIVE_HOST'),true);
 assert.equal(emulation.modelCallToExternalHost,false);
 assert.equal(emulation.independentLabels,false);
 assert.equal(canaries.status.includes('NOT_NATIVE_SKILL_INSTALLATION'),true);
});