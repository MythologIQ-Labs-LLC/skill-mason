import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  validateSpectrum,scoreSpectrum,exemplarForJudgeTest,loadSealedOriginalSkill,
  trialSpectrum,SPECTRUM_SCHEMA
} from '../bin/ci-triage-spectrum-trial.mjs';

const source=await readFile(new URL('./fixtures/ci-triage-quality-spectrum-v2.json',import.meta.url));
const data=JSON.parse(source);
test('Gherkin: 30 unique cases, five equal categories, exact original log citations',()=>{
 const cases=validateSpectrum(data);
 assert.equal(data.schema,SPECTRUM_SCHEMA);
 assert.equal(cases.length,30);
 assert.equal(new Set(cases.map(c=>c.id)).size,30);
 assert.deepEqual([...new Set(cases.map(c=>c.group))],data.groups);
 assert.ok(cases.some(c=>c.oracle.mode==='abstain'));
 assert.ok(cases.some(c=>c.oracle.mode==='multi'));
 assert.ok(cases.some(c=>c.oracle.mode==='observed_only'));
});
test('Gherkin: each case permits a cautious, cited, no-tool synthetic oracle answer',()=>{
 // Generated test answers calibrate the judge, NOT an actual agent or skill.
 for(const c of data.cases){
  const x=scoreSpectrum(exemplarForJudgeTest(c),c);
  assert.equal(x.pass,true,c.id+' '+JSON.stringify(x.flags));
  assert.ok(Object.values(x.checks).every(Boolean));
 }
});
test('Gherkin: hallucinated evidence, fabricated action and unsafe claims fail',()=>{
 for(const c of data.cases){
  const normal=JSON.parse(exemplarForJudgeTest(c));
  assert.equal(scoreSpectrum(JSON.stringify({...normal,evidence:['hallucinated line']}),c).pass,false,c.id);
  assert.equal(scoreSpectrum(JSON.stringify({...normal,actions_executed:['ran deployment']}),c).pass,false,c.id);
  assert.equal(scoreSpectrum(JSON.stringify({...normal,verification_executed:'RAN'}),c).pass,false,c.id);
  assert.equal(scoreSpectrum('not-json',c).pass,false,c.id);
  assert.equal(scoreSpectrum('{}',c).pass,false,c.id);
  for(const disallowed of c.oracle.forbidden_claim_fragments){
   assert.equal(scoreSpectrum(JSON.stringify({...normal,observed_failure:normal.observed_failure+' '+disallowed}),c).pass,false,c.id+' '+disallowed);
  }
 }
});
test('Gherkin: abstention is mandatory for missing job evidence or old revision',()=>{
 for(const c of data.cases.filter(x=>x.oracle.mode==='abstain')){
  const overclaim={...JSON.parse(exemplarForJudgeTest(c)),
    abstains:false,observed_failure:'We know exactly why build failed'};
  const result=scoreSpectrum(JSON.stringify(overclaim),c);
  assert.equal(result.pass,false,c.id);
  assert.equal(result.checks.localization,false);
 }
});
test('Gherkin: mixed-job observation requires both jobs, never one generic cause',()=>{
 const c=data.cases.find(x=>x.id==='two-jobs');
 const shallow={...JSON.parse(exemplarForJudgeTest(c)),
   observed_failure:'Only linux lint failed'};
 assert.equal(scoreSpectrum(JSON.stringify(shallow),c).checks.localization,false);
});
test('Gherkin: self-asserted live status on a mock cannot become host evidence',async(t)=>{
 const dir=process.env.CI_TRIAGE_ORIGINAL_PACKAGE_DIR;
 if(!dir){t.skip('Original sealed real guest artifact supplied only in pinned CI integration job');return;}
 const actual=await loadSealedOriginalSkill(dir);
 assert.ok(actual.skill.includes('#### Stop conditions'));
 assert.equal(actual.manifestSha256,data.skill_package_sha256);
 let calls=0;
 const mock=async({messages})=>{
  const c=data.cases.find(c=>messages[1].content.includes(c.log));
  assert.ok(c,'each message must contain the original untrusted case log');
  calls++;
  return {output:exemplarForJudgeTest(c),model:'mock.spectrum',usage:null};
 };
 const result=await trialSpectrum({packageDir:dir,cases:data,model:'mock.spectrum',
   completion:mock,live:true});
 assert.equal(calls,60);
 assert.equal(result.state,'EMULATED_OR_MOCKED_NO_HOST_PROOF');
 assert.equal(result.hostBehaviorObserved,false);
 assert.equal(result.outputQualityJudgedBy,'DETERMINISTIC_ORACLE_NOT_INDEPENDENT_HUMAN_REVIEW');
 for(const group of data.groups){
  assert.equal(result.totals.baseline[group].passed,6);
  assert.equal(result.totals.generated_skill[group].passed,6);
 }
 assert.equal(result.productionEligible,false);
 assert.equal(result.rightsQualified,false);
});
test('Gherkin: forged test corpus cannot quietly add/upgrade cases',()=>{
 const clone=JSON.parse(JSON.stringify(data));
 clone.cases[0].oracle.required_exact_lines=['not in source'];
 assert.throws(()=>validateSpectrum(clone),{code:'SPECTRUM_CASE'});
 clone.cases[0].oracle.required_exact_lines=data.cases[0].oracle.required_exact_lines;
 clone.cases.pop();
 assert.throws(()=>validateSpectrum(clone),{code:'SPECTRUM_SOURCE'});
});
