import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PAIR_PINS,openPinnedSkill,compareSealedSkills,messagesForSkill,loadComparisonCases} from '../bin/ci-triage-v3-v4-compare.mjs';
import {exemplarForJudgeTest} from '../bin/ci-triage-spectrum-trial.mjs';

const data=JSON.parse(await readFile(new URL('./fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url)));
test('the live-model entrypoint actually loads and validates all 30 frozen CI scenarios',async()=>{
 const {cases,raw}=await loadComparisonCases();
 assert.equal(cases.cases.length,30);
 assert.equal(cases.case_count,30);
 assert.equal(cases.schema,'qortara/ci-triage-quality-spectrum/2');
 assert.equal(raw.length>20000,true);
 assert.deepEqual(cases.cases.map(x=>x.id),data.cases.map(x=>x.id));
});
test('v3 and v4 source pins target actual different P0 generated instructions',()=>{
 assert.equal(PAIR_PINS.v3.id,'ci-failure-triage-v3');
 assert.equal(PAIR_PINS.v4.id,'ci-failure-triage-v4');
 assert.match(PAIR_PINS.v3.skillSha256,/^[a-f0-9]{64}$/);
 assert.match(PAIR_PINS.v4.skillSha256,/^[a-f0-9]{64}$/);
 assert.notEqual(PAIR_PINS.v3.skillSha256,PAIR_PINS.v4.skillSha256);
 assert.notEqual(PAIR_PINS.v3.sourceSha256,PAIR_PINS.v4.sourceSha256);
 assert.equal(PAIR_PINS.v4.originalCommit,'de2be11765ede34be59d9a64c2a1b434b0ca4bcc');
});
test('negative: missing sealed package and invalid arm cannot be treated as a host experiment',async()=>{
 await assert.rejects(openPinnedSkill('/definitely/missing','v4'));
 await assert.rejects(openPinnedSkill('/definitely/missing','arbitrary'),{code:'PAIR_ARM'});
});
test('both arms receive identical task evidence but different exact skill instructions',()=>{
 const item=data.cases[0];
 const m=messagesForSkill('PROCEDURE V3',item);
 assert.equal(m.length,2);
 assert.equal(m[0].role,'system');
 assert.equal(m[1].role,'user');
 assert.ok(m[1].content.includes(item.log));
 assert.ok(m[0].content.includes('PROCEDURE V3'));
 assert.ok(!m[0].content.includes('REQUESTED:'));
});
test('actual pinned sealed P0 artifacts support 60 paired mock transports without impersonating a live model',async(t)=>{
 const v3Dir=process.env.CI_TRIAGE_PAIR_V3_DIR;
 const v4Dir=process.env.CI_TRIAGE_PAIR_V4_DIR;
 if(!v3Dir||!v4Dir){t.skip('Exact pinned generated artifact supplied only in isolated artifact-backed CI');return;}
 const v3=await openPinnedSkill(v3Dir,'v3'),v4=await openPinnedSkill(v4Dir,'v4');
 assert.notEqual(v3.skill,v4.skill);
 assert.ok(v4.skill.includes('RELATION:'));
 assert.ok(v3.skill.includes('Authorization headers'));
 assert.ok(v4.skill.includes('Authorization headers'));
 let count=0;
 const mock=async({messages})=>{
  const caseItem=data.cases.find(c=>messages[1].content.includes(c.log));
  assert.ok(caseItem,'complete original case log passed to mock');
  count++;
  return {output:exemplarForJudgeTest(caseItem),model:'mock.not-real',id:null,usage:null};
 };
 const result=await compareSealedSkills({v3Dir,v4Dir,cases:data,model:'mock.not-real',
   token:'not-a-real-key',completion:mock,live:true});
 assert.equal(count,60);
 assert.equal(result.caseCount,30);
 assert.equal(result.modelCalls,60);
 assert.equal(result.hostBehaviorObserved,false);
 assert.equal(result.state,'TEST_DOUBLE_NOT_HOST_EVIDENCE');
 assert.equal(result.automatedRubric,'STRICT_LEXICAL_EXPERIMENTAL_NOT_SEMANTIC_OR_INDEPENDENT');
 for(const version of ['v3','v4']){
  assert.equal(result.scores[version].passed,30);
  assert.equal(result.scores[version].promptTokens,null,'unknown usage is not zero');
  assert.equal(result.scores[version].completionTokens,null);
  assert.equal(result.scores[version].observedTokenUsageCases,0);
 }
 assert.equal(result.productionEligible,false);
 assert.equal(result.sourceRightsQualified,false);
 assert.equal(result.testOraclesIndependentlyAdjudicated,false);
});
