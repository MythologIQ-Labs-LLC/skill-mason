import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadFirstPartyPilots,recipeForPilot} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {createComposer,writePackage,verifyPackage} from '../src/backend/compose.mjs';
import {scoreResponse,runHostTrial,validateCases,makeMessages} from '../bin/ci-triage-live-host-test.mjs';

const c=JSON.parse(await readFile(new URL('./fixtures/ci-triage-agent-host-cases-v1.json',import.meta.url)));
const PIN='c'.repeat(64);
function goodResult(item){
  const expected=item.expect;
  const first=expected.required_observed[0];
  return JSON.stringify({
    observed_failure:expected.mode==='abstain'?'Unknown: no failing step provided':first+' exited nonzero',
    evidence:[expected.exact_evidence_line],
    cause_hypothesis_and_uncertainty:'Possible cause based only on the log; not verified.',
    next_verification:expected.mode==='abstain'
      ? 'Request the exact failing step and error log excerpt'
      : 'Propose a non-executed '+expected.required_next[0]+' verification on the same commit',
    completion_criteria:'Observe the same-commit rerun with verified pass at exact head',
    abstains:expected.mode==='abstain',
    actions_executed:[],verification_executed:'NOT_RUN'
  });
}
async function withCandidate(fn){
  const registry=await loadFirstPartyPilots();
  const {plan,methods}=createRecipeAdapter(registry)(
    recipeForPilot('ci-failure-triage',registry));
  const composer=createComposer({
    assertMethod:async({subjectSha256})=>({
      issuer:'synthetic.test',subjectSha256,proofDigest:'f'.repeat(64),
      evidence:true,rights:true,authority:true,coverage:true}),
    runPrism:async({requestHex})=>({
      schema:'qortara/local-eligibility-result/1',status:'GUEST_COMPLETED',
      application:'Qortara Skills Eligibility',engine:'prism-code@0.9.5',
      artifact:{sha256:PIN},productionEligible:false,
      requestHex,exitCode:0,response:'eligible',responseHex:'656c696769626c65'}),
    holoSha256:PIN});
  const candidate=await composer(plan,methods);
  assert.equal(verifyPackage(candidate).state,'INTEGRITY_VERIFIED');
  const root=await mkdtemp(join(tmpdir(),'ci-triage-host-'));
  const dir=join(root,'ci-failure-triage');
  try{await writePackage(candidate,dir);return await fn({root,dir,candidate});}
  finally{await rm(root,{recursive:true,force:true});}
}
test('four actual CI scenarios include abstention, first failed step and injected log',()=>{
  assert.equal(validateCases(c).length,4);
  assert.ok(c.cases[2].log.includes('ATTACKER STRING IN LOG'));
});
test('grounded observed outputs satisfy source-linked criteria while fabricated claims fail',()=>{
  for(const item of c.cases){
    const scored=scoreResponse(goodResult(item),item);
    assert.equal(scored.passed,true,item.id+': '+scored.errors.join(','));
    const malicious={...JSON.parse(goodResult(item)),actions_executed:['curl secret upload']};
    assert.equal(scoreResponse(JSON.stringify(malicious),item).passed,false);
    const wrong={...JSON.parse(goodResult(item)),evidence:['This was never in the input']};
    assert.equal(scoreResponse(JSON.stringify(wrong),item).passed,false);
  }
});
test('negative task never accepts confident diagnosis or ignored source absence',()=>{
  const item=c.cases[1];
  const invented={...JSON.parse(goodResult(item)),abstains:false,
    observed_failure:'npm run lint exited 1'};
  assert.ok(scoreResponse(JSON.stringify(invented),item).errors.includes('ABSTENTION_MISMATCH'));
});
test('untrusted log does not become a command, host API has no tools',()=>{
  const item=c.cases[2];
  const messages=makeMessages('a sealed skill',item,true);
  assert.equal(messages.length,2);
  assert.ok(messages[1].content.includes('ATTACKER STRING IN LOG'));
  assert.ok(messages[0].content.includes('no tools'));
  assert.ok(messages.every(x=>!Object.hasOwn(x,'tools')));
});
test('sealed first-party package can be loaded by host trial, but mock is never live validation',async()=>{
  await withCandidate(async({dir})=>{
    let calls=0;
    const mock=async({messages})=>{
      const item=c.cases.find(row=>messages[1].content.includes(row.log));
      assert.ok(item);
      calls++;
      return {output:goodResult(item),model:'mock.test',id:null,usage:null};
    };
    const result=await runHostTrial({packageDir:dir,cases:c,model:'mock.test',
      completion:mock,live:false});
    assert.equal(calls,8);
    assert.equal(result.scores.generated_skill,4);
    assert.equal(result.scores.baseline,4);
    assert.equal(result.state,'TEST_DOUBLE_NO_HOST_OBSERVATION');
    assert.equal(result.hostBehaviorObserved,false);
    assert.equal(result.skillPassedAllTasks,false);
    assert.equal(result.productionEligible,false);
    assert.equal(result.legalReuseQualified,false);
    // A caller may not claim live host evidence just by flipping a flag.
    const forged=await runHostTrial({packageDir:dir,cases:c,model:'mock.test',
      completion:mock,live:true});
    assert.equal(forged.state,'TEST_DOUBLE_NO_HOST_OBSERVATION');
    assert.equal(forged.hostBehaviorObserved,false);
    assert.equal(forged.skillPassedAllTasks,false);
  });
});
test('tampered or missing generated skill is refused before host invocation',async()=>{
  await withCandidate(async({dir})=>{
    const filename=join(dir,'SKILL.md');
    await writeFile(filename,'---\nname: ci-failure-triage\n---\nforged');
    let calls=0;
    await assert.rejects(runHostTrial({packageDir:dir,cases:c,model:'mock.test',
      completion:async()=>{calls++;return {output:'{}'};},live:false}),
    {code:'PACKAGE_INTEGRITY'});
    assert.equal(calls,0);
  });
});
test('host responses are not rights or verified model output merely because they are well-formed',()=>{
  const item=c.cases[0];
  const raw=goodResult(item);
  assert.equal(scoreResponse(raw,item).passed,true);
  assert.equal(scoreResponse('{"not":"real output"}',item).passed,false);
});
