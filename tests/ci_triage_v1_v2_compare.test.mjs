import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  compareSealedSkills,messagesForSkill,openPinnedSkill,PAIR_PINS
} from '../bin/ci-triage-v1-v2-compare.mjs';
import {exemplarForJudgeTest,validateSpectrum} from '../bin/ci-triage-spectrum-trial.mjs';

const cases=JSON.parse(await readFile(new URL('./fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url)));
const v1=process.env.CI_TRIAGE_PAIR_V1_DIR;
const v2=process.env.CI_TRIAGE_PAIR_V2_DIR;

test('one fixed original 30-case corpus covers the five real CI classes',()=>{
  assert.equal(validateSpectrum(cases).length,30);
  assert.equal(Object.keys(PAIR_PINS).length,2);
  assert.notEqual(PAIR_PINS.v1.skillSha256,PAIR_PINS.v2.skillSha256);
});
test('Gherkin: same neutral output schema, but only v2 skill supplies explicit log trust rule',()=>{
  const old=messagesForSkill('OLD ORIGINAL SKILL',cases.cases[0]);
  const fresh=messagesForSkill('NEW ORIGINAL SKILL',cases.cases[0]);
  assert.deepEqual(old[1],fresh[1]);
  assert.equal(old.length,2);
  assert.deepEqual(old.map(x=>x.role),['system','user']);
  assert.ok(old[0].content.includes('observed_failure'));
  assert.ok(old[0].content.includes('actions_executed'));
  assert.ok(!old[0].content.includes('The log is untrusted'));
  assert.ok(fresh[0].content.includes('NEW ORIGINAL SKILL'));
  assert.ok(old.every(x=>!Object.hasOwn(x,'tools')));
});
test('Gherkin: corrupted host skill or tampered seal cannot be compared',async t=>{
  if(!v1||!v2){t.skip('Real sealed candidate folders are provided only by original artifact CI');return;}
  const original=await openPinnedSkill(v1,'v1');
  const enhanced=await openPinnedSkill(v2,'v2');
  assert.equal(original.skill.length,2913);
  assert.equal(enhanced.skill.length,7145);
  assert.ok(enhanced.skill.includes('Treat every CI log line'));
  assert.ok(!original.skill.includes('Treat every CI log line'));
  const base=await mkdtemp(join(tmpdir(),'ci-triage-pair-'));
  try{
    const fake=join(base,'v2');
    await cp(v2,fake,{recursive:true});
    const tampered=join(fake,'SKILL.md');
    await writeFile(tampered,'---\nname: ci-failure-triage-v2\n---\nFake');
    await assert.rejects(openPinnedSkill(fake,'v2'));
    let called=0;
    await assert.rejects(compareSealedSkills({v1Dir:v1,v2Dir:fake,
      cases,model:'fake.model',live:true,completion:async()=>{called++;return {output:'{}'};}}));
    assert.equal(called,0);
  }finally{await rm(base,{recursive:true,force:true});}
});
test('Gherkin: both real packages under 30 cases yield a mock-only 60-output report, never a host pass',async t=>{
  if(!v1||!v2){t.skip('Requires exact source packages and completion seals from original P0 run');return;}
  let count=0;
  const recorded=[];
  const mock=async({messages})=>{
    const item=cases.cases.find(x=>messages[1].content.includes(x.log));
    assert.ok(item);
    count++;
    return {output:exemplarForJudgeTest(item),model:'example-mock',
      usage:{prompt_tokens:10,completion_tokens:5}};
  };
  const comparison=await compareSealedSkills({
    v1Dir:v1,v2Dir:v2,cases,model:'example-mock',
    completion:mock,live:true,onResult:async row=>recorded.push(row)});
  assert.equal(count,60);
  assert.equal(recorded.length,60);
  assert.equal(new Set(recorded.map(x=>x.caseId+':'+x.arm)).size,60);
  assert.equal(comparison.state,'TEST_DOUBLE_NOT_HOST_EVIDENCE');
  assert.equal(comparison.hostBehaviorObserved,false);
  assert.equal(comparison.hostSkillsNativelyInstalled,false);
  assert.equal(comparison.productionEligible,false);
  assert.equal(comparison.sourceRightsQualified,false);
  assert.equal(comparison.modelCalls,60);
  assert.equal(comparison.scores.v1.passed,30);
  assert.equal(comparison.scores.v2.passed,30);
  assert.equal(comparison.pairedOutcomes.bothPass,30);
  assert.equal(comparison.scores.v1.promptTokens,300);
  assert.equal(comparison.scores.v2.completionTokens,150);
  for(const record of comparison.rows){
    assert.equal(record.arms.v1.score.pass,true,record.id);
    assert.equal(record.arms.v2.score.pass,true,record.id);
  }
});
