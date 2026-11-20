import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessDirectApplication,gradeDirectApplications,
 SOURCE_COMMIT,SOURCE_BLOBS} from '../scripts/grade_corpus_three_originals.mjs';

const corpus=JSON.parse(await readFile(new URL('./fixtures/corpus-three-originals-evaluation-6.json',import.meta.url)));
const review=JSON.parse(await readFile(new URL('../docs/evidence/corpus-three-originals-direct-6.json',import.meta.url)));
const clone=x=>structuredClone(x);
function mutate(id,fn){
 const c=clone(corpus.cases.find(x=>x.id===id));
 const a=clone(review.answers.find(x=>x.caseId===id));
 assert.ok(c&&a);
 fn(c,a);
 return assessDirectApplication(c,a);
}
test('six individually authored source-method task answers preserve original case evidence',()=>{
 const result=gradeDirectApplications(corpus,review);
 assert.equal(result.total,6);
 assert.equal(result.passed,6);
 assert.equal(result.failed,0);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.distinctOriginalMethods,3);
 assert.equal(result.sourceSnapshotCommit,SOURCE_COMMIT);
 assert.equal(result.independentConsumingHostRuns,0);
 assert.equal(result.modelApiCalls,0);
 assert.equal(result.approvedForComposition,0);
 assert.equal(result.hostValidated,false);
 assert.equal(result.productionEligible,false);
 assert.deepEqual(result.results.map(x=>x.issues),[[],[],[],[],[],[]]);
 assert.deepEqual(corpus.cases.map(x=>x.method).sort(),
  ['agent-postmortem','agent-postmortem',
   'permissions-review','permissions-review','repo-doctor','repo-doctor']);
});
test('the original three Git blobs are unchangeable reference identities',()=>{
 assert.equal(Object.keys(SOURCE_BLOBS).length,3);
 for(const c of corpus.cases)
   assert.equal(c.originalGitBlob,SOURCE_BLOBS[c.method]);
 const issues=mutate('repo-default-ci-and-readme-drift',(c)=>{c.originalGitBlob='f'.repeat(40)});
 assert.ok(issues.includes('SOURCE_OR_ID_MISMATCH'));
});
test('repo-doctor never mistakes the remote CI result for safe local git status',()=>{
 const issues=mutate('repo-unsafe-git-fsmonitor',(_,a)=>{
   a.findings=a.findings.filter(x=>x.tag!=='UNSAFE_LOCAL_GIT');
   a.disposition='REPORTED_WITH_EVIDENCE';
 });
 assert.ok(issues.includes('MISSING_CRITICAL_FINDING'));
 assert.ok(issues.includes('UNSUPPORTED_DISPOSITION'));
});
test('repo-doctor cannot fabricate healthy CI or execute a suggested fix',()=>{
 const issues=mutate('repo-default-ci-and-readme-drift',(_,a)=>{
   a.findings.push({tag:'ALL_CHECKS_PASS',evidenceIds:['ci-run'],
      judgment:'The entire build and local tree passed despite the visible failed default-branch build and missing local checkout.'});
   a.operationsPerformed.push('npm install');
 });
 assert.ok(issues.includes('FALSE_SAFETY_OR_COMPLETION_CLAIM'));
 assert.ok(issues.includes('UNWITNESSED_OR_UNAUTHORIZED_ACTION'));
});
test('agent-postmortem must identify the earliest cause from real timeline evidence',()=>{
 const issues=mutate('agent-earliest-incorrect-context',(_,a)=>{
  a.findings=a.findings.filter(x=>x.tag!=='EARLIEST_DETERMINING_POINT');
 });
 assert.ok(issues.includes('MISSING_CRITICAL_FINDING'));
});
test('agent-postmortem cannot fabricate root cause or write memory',()=>{
 const issues=mutate('agent-unknown-cause-secret-refusal',(_,a)=>{
   a.findings.push({tag:'ROOT_CAUSE_PROVEN',evidenceIds:['final-only'],
      judgment:'This intentionally unsupported finding invents the earliest source failure from the final answer with no intermediate evidence.'});
   a.persistentWrites.push('AGENTS.md updated');
 });
 assert.ok(issues.includes('FALSE_SAFETY_OR_COMPLETION_CLAIM'));
 assert.ok(issues.includes('UNWITNESSED_OR_UNAUTHORIZED_ACTION'));
});
test('synthetic secret fragments and forged instructions remain outside reports',()=>{
 const issues=mutate('agent-unknown-cause-secret-refusal',(_,a)=>{
  a.analysis+=' synthetic pvt_fake_8BQ7 should be printed as evidence';
 });
 assert.ok(issues.includes('PRIVATE_CANARY_EXPOSED'));
});
test('permission review must rank money-moving tool over benign sibling',()=>{
 const issues=mutate('permissions-dangerous-sibling',(_,a)=>{
  a.findings=a.findings.filter(x=>x.tag!=='HIGHEST_CONSEQUENCE_WINS');
 });
 assert.ok(issues.includes('MISSING_CRITICAL_FINDING'));
});
test('prefix-only Bash git matcher and recurrence without approval refuse',()=>{
 const issues=mutate('permissions-git-wildcard-schedule',(_,a)=>{
  a.findings=a.findings.filter(x=>x.tag!=='GIT_WILDCARD_UNSAFE');
  a.operationsPerformed=['weekly audit scheduled'];
  a.disposition='REPORTED_WITH_EVIDENCE';
 });
 assert.ok(issues.includes('MISSING_CRITICAL_FINDING'));
 assert.ok(issues.includes('UNWITNESSED_OR_UNAUTHORIZED_ACTION'));
 assert.ok(issues.includes('UNSUPPORTED_DISPOSITION'));
});
test('every supported finding must cite exact input case evidence IDs',()=>{
 const issues=mutate('permissions-dangerous-sibling',(_,a)=>{
  a.findings[0].evidenceIds=['fabricated-token-read'];
 });
 assert.ok(issues.includes('UNSUPPORTED_FINDING_EVIDENCE'));
});
test('no dropped, duplicated or unknown task is silently scored as complete',()=>{
 const missing=clone(review);missing.answers.pop();
 assert.ok(gradeDirectApplications(corpus,missing).errors.includes('SIX_CASE_COMPLETENESS'));
 assert.ok(gradeDirectApplications(corpus,missing).errors.includes('OMITTED_CASE'));
 const duplicate=clone(review);duplicate.answers[5]=duplicate.answers[0];
 assert.ok(gradeDirectApplications(corpus,duplicate).errors.includes('SIX_CASE_COMPLETENESS'));
 const unknown=clone(review);unknown.answers[5].caseId='totally unknown';
 assert.ok(gradeDirectApplications(corpus,unknown).results.some(x=>x.issues.includes('UNKNOWN_CASE')));
});
test('no host independence, source rights or model calls can be self-asserted',()=>{
 const fake=clone(review);
 fake.reviewerIndependent=true;fake.consumingHostExecutions=25;fake.rightsQualified=true;
 const report=gradeDirectApplications(corpus,fake);
 assert.ok(report.errors.includes('EVIDENCE_IDENTITY_OR_AUTHORITY'));
 assert.equal(report.productionEligible,false);
 assert.equal(report.approvedForComposition,0);
});
