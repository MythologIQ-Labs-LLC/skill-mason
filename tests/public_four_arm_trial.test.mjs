/** Public original-source preview acceptance; no actual host output is minted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadFirstPartyPilots,recipeForPilot} from '../src/backend/first-party-pilots.mjs';
import {createRecipeAdapter} from '../src/backend/recipe-adapter.mjs';
import {renderUnqualifiedTrialPreview} from '../src/backend/compose.mjs';
import {buildPublicFourArmTrial,scorePublicFourArmTrial}
 from '../src/evaluation/public-four-arm-trial.mjs';
import {execute} from '../bin/public-four-arm-trial.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const source=JSON.parse(await readFile(new URL(
 './fixtures/combined-ci-release-boundaries-v1.json',import.meta.url),'utf8'));
function mockResponses(preview){
 const arms={};
 for(const arm of ['baseline','ci_only','release_only','combined']){
  arms[arm]={
   schema:'qortara/combined-ci-release-raw-responses/1',
   origin:'OPERATOR_TRANSCRIBED_UNATTESTED',
   cases:source.cases.map(c=>({
    id:c.id,hostLabel:'fixture-host-not-independent',
    sessionLabel:'synthetic-'+arm+'-'+c.id,
    rawResponse:[
     'CI_STATE: '+c.oracle.ciState,
     'RELEASE_DECISION: '+c.oracle.releaseDecision,
     'EVIDENCE_IDS: '+c.oracle.mustCite.join(', '),
     'ACTIONS_EXECUTED: NONE',
     'FINDINGS: '+c.oracle.requiredFindings.join('; ')+
      '; source evidence only; no tools, signing or publishing executed.'
    ].join('\n')
   }))
  };
 }
 return {
  schema:'qortara/public-four-arm-host-responses/1',
  previewSha256ByArm:Object.fromEntries(
   Object.entries(preview.arms).map(([arm,v])=>[arm,v?.contentSha256??null])
  ),arms
 };
}
test('the public preview contains 32 paired tasks and 3 exactly original source-backed instruction sets',async()=>{
 const p=await buildPublicFourArmTrial();
 assert.equal(p.schema,'qortara/public-four-arm-source-trial/1');
 assert.equal(p.taskCount,8);assert.equal(p.armTaskCount,32);
 assert.equal(p.answerOraclesIncluded,false);
 assert.equal(p.modelCalls,0);assert.equal(p.prismInvoked,false);
 assert.equal(p.productionEligible,false);assert.equal(p.sourceRightsApproved,false);
 assert.equal(p.arms.baseline,null);
 assert.equal(p.tasks.length,8);
 for(const task of p.tasks){
  const original=source.cases.find(x=>x.id===task.id);
  assert.deepEqual(task.evidence,original.evidence);
  assert.equal(task.prompt,original.prompt);
  assert.ok(!Object.hasOwn(task,'oracle'));
  assert.ok(!Object.hasOwn(task,'requiredFindings'));
  assert.ok(!Object.hasOwn(task,'forbiddenFindings'));
 }
 const expected={
  ci_only:['ci-failure-triage-v5'],
  release_only:['release-readiness-review-v2'],
  combined:['ci-failure-triage-v5','release-readiness-review-v2']
 };
 for(const [arm,ids] of Object.entries(expected)){
  const v=p.arms[arm];
  assert.equal(v.state,'UNQUALIFIED_READ_ONLY_INSTRUCTIONS_NOT_A_COMPOSED_SKILL');
  assert.deepEqual(v.methodPins.map(x=>x.id).sort(),ids.sort());
  assert.equal(digest(v.instructions),v.contentSha256);
  assert.equal(v.prismInvoked,false);
  assert.equal(v.sourceReuseRightsApproved,false);
  assert.equal(v.hostSkillInstalled,false);
  assert.equal(v.productionEligible,false);
  assert.ok(v.instructions.includes('NOT a qualified or host-tested skill'));
  assert.ok(v.instructions.includes('not authorization to install or run tools'));
  assert.ok(v.instructions.includes('## Source-backed methods'));
  assert.equal(Object.hasOwn(v,'files'),false);
  assert.equal(Object.hasOwn(v,'RECEIPT.json'),false);
  assert.equal(Object.hasOwn(v,'skill-mason.json'),false);
 }
 assert.ok(p.arms.combined.instructions.includes('## Multi-method evidence reconciliation'));
 for(const arm of ['ci_only','release_only'])
  assert.ok(!p.arms[arm].instructions.includes('## Multi-method evidence reconciliation'));
 assert.ok(p.arms.combined.instructions.includes('Do not report overall approval'));
});
test('the public trial repeats exactly the immutable, SHA-pinned original source procedures',async()=>{
 const p=await buildPublicFourArmTrial();
 const reg=await loadFirstPartyPilots();
 assert.equal(p.corpusSourceSnapshotSha256,reg.sourceSnapshot.sha256);
 for(const [arm,ids] of [
  ['ci_only',['ci-failure-triage-v5']],
  ['release_only',['release-readiness-review-v2']],
  ['combined',['ci-failure-triage-v5','release-readiness-review-v2']]
 ]){
  for(const id of ids){
   const def=reg.components.find(c=>c.method_id===id);
   const pin=p.arms[arm].methodPins.find(m=>m.id===id);
   assert.equal(pin.sourceSha256,def.method.sha256);
   assert.equal(pin.packageSha256,def.package_sha256);
   assert.equal(pin.sourceCommit,def.method.commit);
  }
 }
 const adapter=createRecipeAdapter(reg);
 const {plan,methods}=adapter(recipeForPilot('ci-failure-triage-v5',reg));
 assert.throws(()=>renderUnqualifiedTrialPreview({...plan,packagePins:[]},methods),
  {code:'SOURCE_PIN'});
 assert.throws(()=>renderUnqualifiedTrialPreview(plan,[{...methods[0],methodText:'untrusted rewrite'}]),
  {code:'SOURCE_MISMATCH'});
 assert.throws(()=>renderUnqualifiedTrialPreview({...plan,requiredOutcomes:['invented approval']},methods),
  {code:'OUTCOME_UNCOVERED'});
});
test('public response comparison retains lexical limits and records negative outcomes',async()=>{
 const p=await buildPublicFourArmTrial();
 const replies=mockResponses(p);
 const good=await scorePublicFourArmTrial({responses:replies});
 assert.equal(good.caseCount,8);
 assert.deepEqual(Object.values(good.summary).map(x=>x.passed),[8,8,8,8]);
 assert.equal(good.causalQualityImprovementDemonstrated,false);
 assert.equal(good.hostOriginCryptographicallyVerified,false);
 assert.equal(good.sourceRightsApproved,false);
 assert.equal(good.productionEligible,false);
 const altered=structuredClone(replies);
 altered.arms.combined.cases[0].rawResponse=altered.arms.combined.cases[0]
  .rawResponse.replace('RELEASE_DECISION: HOLD','RELEASE_DECISION: READY_FOR_OWNER_DECISION');
 const report=await scorePublicFourArmTrial({responses:altered});
 assert.equal(report.summary.combined.failed,1);
 assert.equal(report.paired.combined_vs_ci_only.alternativeWins,1);
 assert.equal(report.combinedVsPerCaseBestSingle.bestSingleWins,1);
 altered.previewSha256ByArm.combined='0'.repeat(64);
 await assert.rejects(scorePublicFourArmTrial({responses:altered}),
  {code:'PUBLIC_TRIAL_PREVIEW_PIN'});
});
test('no-key public CLI prepares trial without model and scores supplied raw input',async()=>{
 const p=await execute(['--prepare']);
 assert.equal(p.armTaskCount,32);
 const cli=fileURLToPath(new URL('../bin/public-four-arm-trial.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[cli,'--prepare'],
  {encoding:'utf8',timeout:20_000,maxBuffer:2_000_000});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),p);
 const root=await mkdtemp(join(tmpdir(),'four-arm-public-'));
 try{
  const target=join(root,'responses.json');
  const responses=mockResponses(p);
  await writeFile(target,JSON.stringify(responses)+'\n');
  const scored=spawnSync(process.execPath,[cli,'--score',target],
   {encoding:'utf8',timeout:20_000,maxBuffer:2_000_000});
  assert.equal(scored.status,0,scored.stderr);
  assert.equal(JSON.parse(scored.stdout).summary.combined.passed,8);
  const malformed=structuredClone(responses);
  malformed.arms.combined.cases[0].sessionLabel=
   malformed.arms.ci_only.cases[0].sessionLabel;
  await writeFile(target,JSON.stringify(malformed)+'\n');
  const denied=spawnSync(process.execPath,[cli,'--score',target],
   {encoding:'utf8',timeout:20_000});
  assert.equal(denied.status,2,denied.stdout);
  assert.equal(JSON.parse(denied.stderr).code,'TRIAL_SESSION_COLLISION');
 }finally{await rm(root,{recursive:true,force:true});}
});
