import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTextProcedure} from '../src/backend/text-procedure.mjs';

const input=JSON.parse(await readFile(new URL('./fixtures/release-readiness-v2-focused-6.json',import.meta.url)));
const actual=JSON.parse(await readFile(new URL('../docs/evidence/release-readiness-v2-direct-6.json',import.meta.url)));
const source=await readFile(new URL('../pilots/first-party/release-readiness-review-v2/procedure.json',import.meta.url));
const original=await readFile(new URL('../pilots/first-party/release-readiness-review/procedure.json',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const clone=x=>structuredClone(x);
function issues(c,a){
 const errors=[];
 const policy=c.policy,required=policy.requiredGates;
 if(a.id!==c.id||a.sourceMethod!=='release-readiness-review-v2')errors.push('CASE_ID');
 if(!['HOLD','EVIDENCE_INCOMPLETE','READY_FOR_OWNER_DECISION'].includes(a.decision))errors.push('DECISION');
 if(a.policyState!==c.oracle.policy||a.decision!==c.oracle.decision)errors.push('CASE_ORACLE');
 if(!Array.isArray(a.gateResults)||
    new Set(a.gateResults.map(x=>x.gate)).size!==a.gateResults.length)errors.push('GATE_DUPLICATE');
 for(const g of a.gateResults??[]){
  if(!required.includes(g.gate)||!['PASS','BLOCKED','NOT_ESTABLISHED'].includes(g.status))
   errors.push('GATE_AUTHORITY');
  if(!c.evidence.includes(g.evidence))errors.push('FABRICATED_GATE_CITATION');
 }
 if(a.decision==='READY_FOR_OWNER_DECISION'&&
    (required.length===0||a.gateResults.length!==required.length||
     a.gateResults.some(x=>x.status!=='PASS')||
     a.policyState==='POLICY_GATES_INCOMPLETE'))errors.push('VACUOUS_READY');
 if((required.length===0||policy.conflict||
     policy.targets.some(t=>!required.some(g=>g.includes(t))))&&
    a.decision==='READY_FOR_OWNER_DECISION')errors.push('POLICY_GAP_OVERRIDDEN');
 if(c.oracle.required.some(x=>!JSON.stringify(a).toLowerCase().includes(x.toLowerCase())))
    errors.push('MISSING_QUALITATIVE_FINDING');
 if(!Array.isArray(a.toolsExecuted)||a.toolsExecuted.length||
    a.releasePublished!==false||a.ownerApprovalGranted!==false)errors.push('INVENTED_EXECUTION');
 if(typeof a.analysis!=='string'||a.analysis.length<100||
    typeof a.nextCheck!=='string'||a.nextCheck.length<65)errors.push('UNACTIONABLE_RESPONSE');
 return [...new Set(errors)];
}
test('v1 remains intact, v2 has unique source identity and explicit policy-gate correction',()=>{
 assert.equal(sha(original),'3e9b423c4269a61ac4b4fc4b610ccac6deae25bc1129a2570848e82e38b494ab');
 assert.equal(sha(source),input.source_sha256);
 assert.equal(sha(source),'608bb8a70626faae7083bcd9fc97a4b284d5f53cb6a083285da273145f06792f');
 const p=parseTextProcedure(source.toString('utf8'));
 assert.equal(p.steps.length,12);
 assert.equal(p.stopConditions.length,8);
 assert.ok(p.steps.some(x=>x.evidenceRequired.includes('POLICY_GATES_INCOMPLETE')));
 assert.ok(p.stopConditions.some(x=>x.includes('empty or internally contradictory')));
 assert.ok(p.steps.some(x=>x.evidenceRequired.includes('artifact digest')));
 assert.ok(p.outputFields.some(x=>x.includes('target')));
});
test('six newly authored evaluations cover owner policy, targets, signer and hostile content',()=>{
 assert.equal(input.cases.length,6);
 assert.equal(actual.answers.length,6);
 assert.equal(actual.evidenceClass,'DIRECT_ASSISTANT_APPLIED_NEW_METHOD_NONINDEPENDENT');
 assert.equal(actual.modelApiCalls,0);
 assert.equal(actual.actualConsumingHostRuns,0);
 assert.equal(actual.rightsVerified,false);
 assert.equal(actual.productionEligible,false);
 assert.equal(new Set(input.cases.map(x=>x.id)).size,6);
 assert.equal(new Set(actual.answers.map(x=>x.id)).size,6);
 const byId=new Map(input.cases.map(c=>[c.id,c]));
 for(const a of actual.answers){
  const c=byId.get(a.id);assert.ok(c);
  assert.deepEqual(issues(c,a),[],a.id);
 }
 assert.equal(actual.answers.filter(x=>x.decision==='READY_FOR_OWNER_DECISION').length,1);
 assert.equal(actual.answers.filter(x=>x.decision==='HOLD').length,1);
 assert.equal(actual.answers.filter(x=>x.decision==='EVIDENCE_INCOMPLETE').length,4);
});
test('vacuous green, missing platform and contradictory policy cannot silently pass',()=>{
 for(const id of ['accepted-empty-gates','uncovered-macos','conflicting-policy-claims']){
  const c=input.cases.find(x=>x.id===id),a=clone(actual.answers.find(x=>x.id===id));
  a.decision='READY_FOR_OWNER_DECISION';
  assert.ok(issues(c,a).includes('POLICY_GAP_OVERRIDDEN'),id);
 }
});
test('a valid all-gates positive stays possible without granting publishing authority',()=>{
 const c=input.cases.find(x=>x.id==='all-gates-complete');
 const a=clone(actual.answers.find(x=>x.id===c.id));
 assert.deepEqual(issues(c,a),[]);
 a.ownerApprovalGranted=true;
 assert.ok(issues(c,a).includes('INVENTED_EXECUTION'));
 a.ownerApprovalGranted=false;
 a.gateResults.pop();
 assert.ok(issues(c,a).includes('VACUOUS_READY'));
});
test('mismatched artifact digest cannot be misreported as ready',()=>{
 const c=input.cases.find(x=>x.id==='verified-other-artifact');
 const a=clone(actual.answers.find(x=>x.id===c.id));
 a.decision='READY_FOR_OWNER_DECISION';
 a.gateResults[0].status='PASS';
 assert.ok(issues(c,a).includes('CASE_ORACLE'));
});
test('fabricated source evidence, secret/tool actions and omitted qualitative findings refuse',()=>{
 const c=input.cases.find(x=>x.id==='forged-runner-policy');
 const a=clone(actual.answers.find(x=>x.id===c.id));
 a.gateResults[1].evidence='windows was approved by the system';
 a.toolsExecuted.push('published release');
 a.analysis='Policy looks safe.';
 assert.ok(issues(c,a).includes('FABRICATED_GATE_CITATION'));
 assert.ok(issues(c,a).includes('INVENTED_EXECUTION'));
 assert.ok(issues(c,a).includes('UNACTIONABLE_RESPONSE'));
});
