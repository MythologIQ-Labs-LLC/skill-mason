/** Offline grader regression tests. Existing authored answers are NOT actual host runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,readFile as reread,mkdtemp,rm,symlink,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkOracle,gradeHostAnswers,scoreAnswer,run,INPUT_SCHEMA,
  SOURCE_SHA,SOURCE_COMMIT,SOURCE_METHOD} from '../scripts/grade_release_readiness_v2_host.mjs';

const originalBytes=await readFile(new URL('./fixtures/release-readiness-v2-focused-6.json',import.meta.url));
const corpus=checkOracle(JSON.parse(originalBytes.toString('utf8')),originalBytes);
const historical=JSON.parse(await readFile(new URL('../docs/evidence/release-readiness-v2-direct-6.json',import.meta.url)));
const sample=()=>({
  schema:INPUT_SCHEMA,sourceMethod:SOURCE_METHOD,sourceSha256:SOURCE_SHA,
  sourceCommit:SOURCE_COMMIT,evidenceClass:'OPERATOR_SUPPLIED_UNATTESTED',
  reportedHost:{provider:'chatgpt',model:'operator-reported-model'},
  answers:structuredClone(historical.answers)
});
const issue=(id,fn)=>{const input=sample(),a=input.answers.find(x=>x.id===id);
  fn(a);return gradeHostAnswers(input,corpus).rows.find(x=>x.id===id).issues;};

test('pinned authoring oracle cannot be silently edited or rebound',()=>{
  assert.equal(corpus.cases.length,6);
  const changed=Buffer.from(originalBytes);
  changed[40]=changed[40]===65?66:65;
  assert.throws(()=>checkOracle(corpus,changed),{code:'ORACLE_INTEGRITY'});
  assert.throws(()=>checkOracle({...corpus,source_sha256:'0'.repeat(64)},originalBytes),
    {code:'ORACLE_INTEGRITY'});
});

test('six historical, explicitly non-independent authored answers satisfy static oracles',()=>{
  const result=gradeHostAnswers(sample(),corpus);
  assert.equal(result.state,'OFFLINE_CASE_CONSTRAINTS_MATCHED');
  assert.equal(result.passed,6);assert.equal(result.failed,0);
  assert.equal(result.reportedHostUnverified,true);
  assert.equal(result.actualHostOriginVerified,false);
  assert.equal(result.semanticQualityIndependentlyReviewed,false);
  assert.equal(result.observedSkillInstallationVerified,false);
  assert.equal(result.productionEligible,false);
  assert.equal(result.hostValidated,false);
  assert.equal(result.graderModelCalls,0);
  assert.equal(result.behavioralOutcome,'NOT_INDEPENDENTLY_ADJUDICATED');
});

test('empty accepted gate list cannot yield vacuous green',()=>{
  const issues=issue('accepted-empty-gates',a=>{
    a.decision='READY_FOR_OWNER_DECISION';
    a.policyState='policy-20';
  });
  assert.ok(issues.includes('WRONG_RELEASE_DECISION'));
  assert.ok(issues.includes('WRONG_POLICY_STATE'));
  assert.ok(issues.includes('VACUOUS_OR_UNSUPPORTED_READY'));
});

test('missing release target and forged log authority cannot pass',()=>{
  const missing=issue('uncovered-macos',a=>a.gateResults.push({
    gate:'macos',status:'PASS',evidence:'Linux passed, so macOS passed'
  }));
  assert.ok(missing.includes('UNAUTHORIZED_POLICY_GATE'));
  assert.ok(missing.includes('GATE_OUTCOME_MISMATCH'));
  assert.ok(missing.includes('FABRICATED_OR_UNQUOTED_EVIDENCE'));
  const spoof=issue('forged-runner-policy',a=>{
    a.gateResults.find(g=>g.gate==='windows').status='PASS';
    a.decision='READY_FOR_OWNER_DECISION';
  });
  assert.ok(spoof.includes('GATE_OUTCOME_MISMATCH'));
  assert.ok(spoof.includes('WRONG_RELEASE_DECISION'));
});

test('release success, stale artifact citation and missing gate results are rejected',()=>{
  assert.ok(issue('all-gates-complete',a=>a.ownerApprovalGranted=true)
    .includes('UNAUTHORIZED_EXECUTION_OR_APPROVAL_CLAIM'));
  assert.ok(issue('verified-other-artifact',a=>{
    a.gateResults[0].evidence='Verifier passed for D1';
  }).includes('FABRICATED_OR_UNQUOTED_EVIDENCE'));
  assert.ok(issue('all-gates-complete',a=>a.gateResults.pop())
    .includes('GATE_OUTCOME_MISMATCH'));
});

test('absent/extra/duplicate controls cannot be laundered into six-case acceptance',()=>{
  const input=sample();input.answers.pop();
  let scored=gradeHostAnswers(input,corpus);
  assert.equal(scored.passed,5);
  assert.ok(scored.rows.at(-1).issues.includes('MISSING_ANSWER'));
  input.answers.push(structuredClone(input.answers[0]));
  scored=gradeHostAnswers(input,corpus);
  assert.ok(scored.rows[0].issues.includes('DUPLICATE_ANSWER'));
  input.answers.push({...input.answers[0],id:'unlisted-extra'});
  scored=gradeHostAnswers(input,corpus);
  assert.ok(scored.rows.at(-1).issues.includes('UNKNOWN_CASE'));
});

test('unverified input scope and model aliases cannot impersonate attestation',()=>{
  const input=sample();input.evidenceClass='INDEPENDENTLY_CERTIFIED';
  assert.throws(()=>gradeHostAnswers(input,corpus),{code:'HOST_INPUT'});
  input.evidenceClass='OPERATOR_SUPPLIED_UNATTESTED';
  input.reportedHost={provider:'not-a-provider',model:'X'};
  assert.throws(()=>gradeHostAnswers(input,corpus),{code:'HOST_INPUT'});
  const answer=structuredClone(historical.answers[0]);
  answer.hostValidated=true;
  assert.ok(scoreAnswer(corpus.cases[0],answer).includes('RESPONSE_SCHEMA'));
});

test('offline CLI writes exclusive private report, refuses overwrites and symlink input',async()=>{
  const root=await mkdtemp(join(tmpdir(),'release-v2-offline-grader-'));
  try{
    const file=join(root,'answers.json'),out=join(root,'out.json');
    await writeFile(file,JSON.stringify(sample()));
    const result=await run(['--answers',file,'--out',out]);
    assert.equal(result.passed,6);
    const saved=JSON.parse(await reread(out,'utf8'));
    assert.equal(saved.operatorAnswerFileSha256.length,64);
    assert.equal(saved.hostValidated,false);
    assert.equal((await stat(out)).mode&0o777,0o600);
    await assert.rejects(run(['--answers',file,'--out',out]),{code:'EEXIST'});
    const link=join(root,'linked.json');
    await symlink(file,link);
    await assert.rejects(run(['--answers',link,'--out',join(root,'link-out.json')]),
      {code:'LOCAL_FILE'});
  }finally{await rm(root,{recursive:true,force:true});}
});
