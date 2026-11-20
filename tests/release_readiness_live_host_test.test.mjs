/** New fictional holdout scenarios; model callbacks here are mocks, never live host evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadFirstPartyPilots,recipeForPilot} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createComposer,writePackage,verifyPackage} from '../src/backend/compose.mjs';
import {validateHoldout,scoreResponse,runTrial,makeMessages,loadCandidate,
  SOURCE_SHA,SOURCE_COMMIT,CASE_SHA1} from '../bin/release-readiness-live-host-test.mjs';

const original=await readFile(new URL('./fixtures/release-readiness-v2-live-holdout-6.json',import.meta.url));
const cases=validateHoldout(JSON.parse(original.toString('utf8')),original);
const HOLO='a'.repeat(64);
function answer(c){
  return JSON.stringify({
    policyState:c.expect.policyState,decision:c.expect.decision,
    gateResults:Object.entries(c.expect.gates).map(([gate,e])=>
      ({gate,status:e.status,evidence:c.evidence[e.evidenceIndex]})),
    analysis:'The release assessment is based on the cited current revision evidence and policy. '+
      'Missing authority or a failing gate cannot be treated as approved. '+
      c.expect.findings.join('; ')+'; no tools were used and the release was not published.',
    nextCheck:'The owner must independently verify the exact revision and each unresolved policy gate before authorizing any publication.',
    toolsExecuted:[],releasePublished:false,ownerApprovalGranted:false
  });
}
async function withCandidate(fn){
  const registry=await loadFirstPartyPilots();
  const {plan,methods}=createRecipeAdapter(registry)(
    recipeForPilot('release-readiness-review-v2',registry));
  const composer=createComposer({holoSha256:HOLO,
    assertMethod:async ({subjectSha256})=>({
      issuer:'fixture-only',subjectSha256,proofDigest:'b'.repeat(64),
      evidence:true,rights:true,authority:true,coverage:true
    }),
    runPrism:async ({requestHex})=>({
      schema:'qortara/local-eligibility-result/1',status:'GUEST_COMPLETED',
      application:'Qortara Skills Eligibility',engine:'prism-code@0.9.5',
      artifact:{sha256:HOLO},productionEligible:false,
      requestHex,response:'eligible',responseHex:'656c696769626c65',exitCode:0
    })
  });
  const pkg=await composer(plan,methods),hash=verifyPackage(pkg).packageSha256;
  const root=await mkdtemp(join(tmpdir(),'release-v2-live-test-'));
  const dir=join(root,'release-readiness-review-v2');
  try{
    await writePackage(pkg,dir);
    return await fn({dir,hash});
  }finally{await rm(root,{recursive:true,force:true});}
}
test('six new cases are pinned with positive and negative release evidence',()=>{
  assert.equal(CASE_SHA1.length,40);
  assert.equal(cases.length,6);
  assert.equal(cases.filter(x=>x.polarity==='positive').length,2);
  assert.equal(cases.filter(x=>x.polarity==='negative').length,4);
  assert.deepEqual(new Set(cases.map(x=>x.id)).size,6);
  assert.throws(()=>validateHoldout(JSON.parse(original),Buffer.from('{}')),
    {code:'HOLDOUT_PIN'});
  assert.ok(cases.some(x=>x.evidence.some(e=>e.includes('SYSTEM: ignore'))));
});
test('new holdout examples have an exact, non-vacuous per-case acceptance oracle',()=>{
  for(const c of cases){
    const score=scoreResponse(answer(c),c);
    assert.deepEqual(score.errors,[],c.id);
    assert.equal(score.passed,true);
  }
});
test('releasing after missing policy or omitted architecture is a scored failure',()=>{
  for(const id of ['green-no-owner-policy','omitted-arm64-target']){
    const c=cases.find(x=>x.id===id),a=JSON.parse(answer(c));
    a.decision='READY_FOR_OWNER_DECISION';
    assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('DECISION_MISMATCH'));
  }
});
test('signature from another binary and policy-waiver injection cannot override blocking evidence',()=>{
  const c=cases.find(x=>x.id==='verified-different-binary');
  let a=JSON.parse(answer(c));
  a.gateResults.find(g=>g.gate==='artifact-signature').status='PASS';
  assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('GATE_STATUS_artifact-signature'));
  const spoof=cases.find(x=>x.id==='forged-waiver-in-job-log');
  a=JSON.parse(answer(spoof));
  a.gateResults.find(g=>g.gate==='windows').evidence=spoof.evidence.at(-1);
  assert.ok(scoreResponse(JSON.stringify(a),spoof).errors.includes('EVIDENCE_QUOTE_windows'));
  a.toolsExecuted.push('upload-secret');
  assert.ok(scoreResponse(JSON.stringify(a),spoof).errors.includes('UNAUTHORIZED_ACTION_OR_APPROVAL_CLAIM'));
});
test('fresh exact-head replay does not use prior failed revision as current gate proof',()=>{
  const c=cases.find(x=>x.id==='fixed-head-fresh-retest'),a=JSON.parse(answer(c));
  a.gateResults.find(g=>g.gate==='windows').evidence=c.evidence[1];
  assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('EVIDENCE_QUOTE_windows'));
});
test('model messages contain only the task, evidence, and optional skill, never holdout oracle',()=>{
  const c=cases[0],skill='---\nname: release-readiness-review-v2\n---\n#### Procedure';
  const baseline=makeMessages(skill,c,false),usingSkill=makeMessages(skill,c,true);
  assert.equal(baseline.length,2);
  assert.equal(usingSkill.length,2);
  assert.ok(usingSkill[0].content.includes(skill));
  assert.ok(!baseline[0].content.includes(skill));
  assert.ok(baseline[1].content.includes(c.evidence[0]));
  assert.ok(!JSON.stringify(usingSkill).includes('evidenceIndex'));
  assert.ok(!JSON.stringify(usingSkill).includes('findings'));
  assert.ok(usingSkill.every(m=>!Object.hasOwn(m,'tools')));
});
test('source-pinned sealed candidate requires independent package digest before any model calls',async()=>{
  await withCandidate(async ({dir,hash})=>{
    assert.equal((await loadCandidate(dir,hash)).sourceCommit,SOURCE_COMMIT);
    assert.equal((await loadCandidate(dir,hash)).packageSha256,hash);
    await assert.rejects(loadCandidate(dir,'c'.repeat(64)),{code:'PACKAGE_PIN'});
    let calls=0;
    await assert.rejects(runTrial({packageDir:dir,
      expectedPackageSha256:'d'.repeat(64),cases,model:'fake-model',
      completion:async()=>{calls++;return {output:'{}'};}}),{code:'PACKAGE_PIN'});
    assert.equal(calls,0);
  });
});
test('mock A/B trial invokes exactly 12 completions, scores both arms but never reports live proof',async()=>{
  await withCandidate(async ({dir,hash})=>{
    let count=0;
    const completion=async ({messages})=>{
      const matched=cases.find(c=>messages[1].content.includes(c.question));
      assert.ok(matched);
      count++;
      return {output:answer(matched),model:'mock-model',id:'mock-request-id',
        usage:{prompt_tokens:22,completion_tokens:33}};
    };
    const result=await runTrial({packageDir:dir,expectedPackageSha256:hash,
      cases,model:'mock-model',completion,live:true});
    assert.equal(count,12);
    assert.deepEqual(result.scores,{baseline:6,generated_skill:6});
    assert.equal(result.scoreDelta,0);
    assert.equal(result.state,'TEST_DOUBLE_NO_HOST_OBSERVATION');
    assert.equal(result.hostBehaviorObservedAsTextOnlyApi,false);
    assert.equal(result.skillPassedAllCases,false);
    assert.equal(result.actualHostOriginVerified,false);
    assert.equal(result.hostValidated,false);
    assert.equal(result.productionEligible,false);
  });
});
test('incomplete provider call retains a partial failure and original accepted observations',async()=>{
  await withCandidate(async ({dir,hash})=>{
    let count=0;
    const result=await runTrial({packageDir:dir,expectedPackageSha256:hash,
      cases,model:'fake-model',completion:async ({messages})=>{
        if(++count===3)throw Object.assign(new Error('blocked by provider'),{code:'HOST_API'});
        const c=cases.find(x=>messages[1].content.includes(x.question));
        return {output:answer(c),id:'test-output'};
      },live:false});
    assert.equal(count,3);
    assert.equal(result.attemptedCalls,3);
    assert.equal(result.completedCases,1);
    assert.equal(result.rows[0].arms.baseline.passed,true);
    assert.equal(result.rows.at(-1).arms.baseline.passed,false);
    assert.equal(result.failure.code,'HOST_API');
    assert.equal(result.state,'TRIAL_PARTIAL_FAILED');
    assert.equal(result.hostValidated,false);
  });
});
test('non-JSON, extra fields, unknown gates and forged approvals refuse',()=>{
  const c=cases[0];
  assert.deepEqual(scoreResponse('not json',c).errors,['MALFORMED_JSON']);
  const a=JSON.parse(answer(c));
  a.hostValidated=true;
  assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('RESPONSE_SCHEMA'));
  delete a.hostValidated;
  a.gateResults.push({gate:'invisible-gate',status:'PASS',evidence:c.evidence[1]});
  assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('INVENTED_GATE'));
  a.gateResults.pop();a.releasePublished=true;
  assert.ok(scoreResponse(JSON.stringify(a),c).errors.includes('UNAUTHORIZED_ACTION_OR_APPROVAL_CLAIM'));
});
