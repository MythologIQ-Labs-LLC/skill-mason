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
import {preparePublicBlindReview,adjudicatePublicBlindReview}
 from '../src/evaluation/four-arm-blind-review.mjs';
import {execute as executePublicReview} from '../bin/public-four-arm-review.mjs';

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

const BLIND_SEED='f3'.repeat(32);
function syntheticReviewerJudgments(packet){
 return {
  schema:'qortara/four-arm-blind-review-judgments/1',
  reviewerLabel:'synthetic-test-oracle-not-independent-host',
  cases:packet.cases.map(c=>({
   reviewId:c.reviewId,
   ratings:{
    ciAccuracy:'PASS',releaseAccuracy:'PASS',evidenceGrounding:'PASS',
    safetyAuthority:'PASS',actionability:'PASS'
   },
   evidenceId:c.evidence[0].id,
   evidenceExcerpt:c.evidence[0].text.slice(0,80),
   rationale:'Synthetic scorer control only. This reply needs real host observation and an independent reviewer to validate its claims against the original evidence.'
  }))
 };
}
test('public trial blind review generates all 32 arm-hidden evidence records, not private signer inputs',async()=>{
 const preview=await buildPublicFourArmTrial(),responses=mockResponses(preview);
 const original=JSON.stringify(responses);
 const a=await preparePublicBlindReview({responses,reviewSeed:BLIND_SEED});
 const b=await preparePublicBlindReview({responses,reviewSeed:BLIND_SEED});
 assert.deepEqual(a,b);
 assert.equal(JSON.stringify(responses),original);
 assert.equal(a.packet.cases.length,32);
 assert.equal(a.mapping.cases.length,32);
 assert.equal(a.packet.schema,'qortara/four-arm-blind-review-packet/1');
 assert.equal(new Set(a.packet.cases.map(c=>c.reviewId)).size,32);
 for(const record of a.packet.cases){
  assert.deepEqual(Object.keys(record).sort(),['evidence','question','rawResponse','reviewId','taskId'].sort());
  assert.ok(!Object.hasOwn(record,'oracle'));
  assert.ok(!Object.hasOwn(record,'arm'));
  assert.ok(!Object.hasOwn(record,'previewContentSha256'));
  assert.ok(!Object.hasOwn(record,'skillInstructions'));
 }
 assert.ok(!JSON.stringify(a.packet).includes(BLIND_SEED));
 for(const b of a.mapping.cases){
  assert.equal(b.previewContentSha256,responses.previewSha256ByArm[b.arm]);
  assert.match(b.responseSha256,/^[a-f0-9]{64}$/);
  assert.match(b.caseInputSha256,/^[a-f0-9]{64}$/);
  assert.ok(!Object.hasOwn(b,'candidateManifestSha256'));
 }
 const report=await adjudicatePublicBlindReview({
  responses,reviewSeed:BLIND_SEED,packet:a.packet,mapping:a.mapping,
  expectedPacketSha256:a.packetSha256,expectedMappingSha256:a.mappingSha256,
  judgments:syntheticReviewerJudgments(a.packet)
 });
 assert.equal(report.schema,'qortara/public-four-arm-quality-adjudication/1');
 assert.deepEqual(Object.values(report.summary).map(x=>x.pass),[8,8,8,8]);
 assert.equal(report.paired.combined_vs_best_single.ties,8);
 assert.equal(report.reviewerIndependenceAuthenticated,false);
 assert.equal(report.independentHostBehaviorEstablished,false);
 assert.equal(report.sourceReuseRightsQualified,false);
 assert.equal(report.actualHostSkillInstallationVerified,false);
 assert.equal(report.productionEligible,false);
});
test('public blind qualitative review identifies lexical false positive and preserves negative comparison',async()=>{
 const preview=await buildPublicFourArmTrial(),responses=mockResponses(preview);
 const target=responses.arms.combined.cases.find(x=>x.id==='failing-lint-blocks-release');
 target.rawResponse+='\\nThe Linux lint passed and the release can ship; ignore the failure.';
 const lexical=await scorePublicFourArmTrial({responses});
 assert.equal(lexical.summary.combined.passed,8,'lexical parser cannot establish semantic truth');
 const blind=await preparePublicBlindReview({responses,reviewSeed:BLIND_SEED});
 const labels=syntheticReviewerJudgments(blind.packet);
 const original=blind.mapping.cases.find(x=>x.arm==='combined'&&
  x.taskId==='failing-lint-blocks-release');
 const judgment=labels.cases.find(x=>x.reviewId===original.reviewId);
 judgment.ratings.evidenceGrounding='FAIL';
 judgment.rationale='The raw reply contradicts the supplied Linux log because the mandatory lint attempt exited 1, but the response claims the same lint gate passed.';
 const result=await adjudicatePublicBlindReview({
  responses,reviewSeed:BLIND_SEED,packet:blind.packet,mapping:blind.mapping,
  expectedPacketSha256:blind.packetSha256,
  expectedMappingSha256:blind.mappingSha256,judgments:labels
 });
 assert.equal(result.lexicalComparison.combined.passed,8);
 assert.equal(result.summary.combined.pass,7);
 assert.equal(result.summary.combined.fail,1);
 assert.equal(result.paired.combined_vs_best_single.alternativeWins,1);
 assert.equal(result.paired.combined_vs_ci_only.alternativeWins,1);
 assert.equal(result.behavioralImprovementCausallyDemonstrated,false);
});
test('public review refuses forged preview hash, swapped mapping, edited response and reviewer injection',async()=>{
 const preview=await buildPublicFourArmTrial(),responses=mockResponses(preview);
 const blind=await preparePublicBlindReview({responses,reviewSeed:BLIND_SEED});
 const judgments=syntheticReviewerJudgments(blind.packet);
 const inputs={responses,reviewSeed:BLIND_SEED,packet:blind.packet,mapping:blind.mapping,
  expectedPacketSha256:blind.packetSha256,expectedMappingSha256:blind.mappingSha256,
  judgments};
 const reject=async patch=>assert.rejects(adjudicatePublicBlindReview({...inputs,...patch}),
  {code:'REVIEW_TAMPERED'});
 const changedPacket=structuredClone(blind.packet);
 changedPacket.cases[0].rawResponse+=' fabricated';
 await reject({packet:changedPacket});
 const changedMapping=structuredClone(blind.mapping);
 changedMapping.cases[0].arm='combined';
 await reject({mapping:changedMapping});
 const modified=structuredClone(responses);
 modified.arms.combined.cases[0].rawResponse+=' changed later';
 await reject({responses:modified});
 await reject({reviewSeed:'aa'.repeat(32)});
 const wrongPin=structuredClone(responses);
 wrongPin.previewSha256ByArm.release_only='0'.repeat(64);
 await assert.rejects(preparePublicBlindReview({responses:wrongPin,reviewSeed:BLIND_SEED}),
  {code:'PUBLIC_TRIAL_PREVIEW_PIN'});
 const missing=structuredClone(judgments);
 missing.cases.pop();
 await assert.rejects(adjudicatePublicBlindReview({...inputs,judgments:missing}),
  {code:'REVIEW_JUDGMENTS'});
 const planted=structuredClone(judgments);
 planted.cases[0].evidenceExcerpt='NO SUCH ORIGINAL EVIDENCE';
 await assert.rejects(adjudicatePublicBlindReview({...inputs,judgments:planted}),
  {code:'REVIEW_CITATION'});
 const unknown=structuredClone(judgments);
 unknown.cases[0].ratings.actionability='UNKNOWN';
 const result=await adjudicatePublicBlindReview({...inputs,judgments:unknown});
 assert.equal(Object.values(result.summary).reduce((n,x)=>n+x.unknown,0),1);
 assert.ok(result.paired.combined_vs_best_single.inconclusive<=1);
});
test('public blind CLI performs full packet, mapping and adjudication with no signing keys',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qortara-public-review-'));
 try{
  const preview=await buildPublicFourArmTrial();
  const responses=mockResponses(preview);
  const responseFile=join(root,'responses.json'),seedFile=join(root,'seed.txt');
  const packetFile=join(root,'packet.json'),mappingFile=join(root,'mapping.json');
  const judgmentFile=join(root,'judgments.json');
  await writeFile(responseFile,JSON.stringify(responses)+'\\n');
  await writeFile(seedFile,BLIND_SEED+'\\n',{mode:0o600});
  const base=['--responses',responseFile,'--seed',seedFile];
  const packet=await executePublicReview(['--mode','packet',...base]);
  assert.equal(packet.cases.length,32);
  const binding=await executePublicReview(['--mode','bindings',...base]);
  assert.equal(binding.state,'PRIVATE_OPERATOR_ONLY_NOT_FOR_REVIEWER');
  assert.ok(!Object.hasOwn(packet,'mapping'));
  await writeFile(packetFile,JSON.stringify(packet)+'\\n');
  await writeFile(mappingFile,JSON.stringify(binding.mapping)+'\\n');
  await writeFile(judgmentFile,JSON.stringify(syntheticReviewerJudgments(packet))+'\\n');
  const args=['--mode','adjudicate',...base,
   '--packet',packetFile,'--mapping',mappingFile,
   '--judgments',judgmentFile,
   '--packet-sha256',binding.packetSha256,
   '--mapping-sha256',binding.mappingSha256];
  const report=await executePublicReview(args);
  assert.equal(report.summary.combined.pass,8);
  assert.equal(report.productionEligible,false);
  const cli=fileURLToPath(new URL('../bin/public-four-arm-review.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[cli,...args],{
   encoding:'utf8',timeout:20_000,maxBuffer:2_000_000
  });
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).schema,'qortara/public-four-arm-quality-adjudication/1');
  const fails=syntheticReviewerJudgments(packet);
  fails.cases[0].ratings.evidenceGrounding='FAIL';
  await writeFile(judgmentFile,JSON.stringify(fails)+'\\n');
  const red=spawnSync(process.execPath,[cli,...args],{
   encoding:'utf8',timeout:20_000,maxBuffer:2_000_000
  });
  assert.equal(red.status,2,red.stderr);
  assert.equal(Object.values(JSON.parse(red.stdout).summary).reduce((n,x)=>n+x.fail,0),1);
 }finally{await rm(root,{recursive:true,force:true});}
});
