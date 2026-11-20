/**
 * One-case external trial feedback is a REAL export path, NOT a full benchmark.
 * Source methods remain unqualified and all model outputs here are test-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicFourArmTrial,scorePublicFourArmTrial}
 from '../../src/evaluation/public-four-arm-trial.mjs';
import {
 ARM_IDS,newWorkspace,recordAnswer,caseCompletion,exportQuickCaseFeedback,
 QUICK_FEEDBACK_SCHEMA,QUICK_COMPARISONS,QUICK_CONCERNS,exportCompletedTrial
} from '../src/four-arm-browser.mjs';
const packet=await buildPublicFourArmTrial();
const html=await readFile(new URL('../trial.html',import.meta.url),'utf8');
const app=await readFile(new URL('../trial.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../trial.css',import.meta.url),'utf8');

function fourReplies(caseId=packet.tasks[0].id){
 let work=newWorkspace(packet,'chatgpt');
 for(const a of ARM_IDS){
  work=recordAnswer(packet,work,a,caseId,
   'Synthetic test-only raw answer under '+a+
   '. A genuine consuming host must be separately observed.');
 }
 return work;
}

test('a tester can export one case with exactly four raw replies without 32 sessions',async()=>{
 const caseId=packet.tasks[0].id;
 const work=fourReplies(caseId);
 assert.deepEqual(caseCompletion(packet,work,caseId),{
  caseId,completed:4,total:4,arms:[...ARM_IDS]
 });
 const feedback=exportQuickCaseFeedback(packet,work,caseId,{
  comparison:'combined-worse',primaryConcern:'evidence-grounding'
 });
 assert.equal(feedback.schema,QUICK_FEEDBACK_SCHEMA);
 assert.equal(feedback.state,'SINGLE_CASE_SELF_REPORTED_PRELIMINARY_NOT_A_BENCHMARK');
 assert.equal(feedback.sourceSnapshotSha256,packet.corpusSourceSnapshotSha256);
 assert.deepEqual(feedback.previewSha256ByArm,
  Object.fromEntries(ARM_IDS.map(a=>[a,a==='baseline'?null:packet.arms[a].contentSha256])));
 assert.equal(feedback.hostLabel,'chatgpt');
 assert.deepEqual(feedback.task,packet.tasks[0]);
 assert.equal(feedback.reportedComparison,'combined-worse');
 assert.equal(feedback.reportedPrimaryConcern,'evidence-grounding');
 assert.equal(feedback.assessedBy,'SELF_REPORTED_UNBLINDED_NOT_INDEPENDENT');
 assert.equal(feedback.rawResponses.length,4);
 assert.deepEqual(feedback.rawResponses.map(r=>r.arm),[...ARM_IDS]);
 assert.ok(feedback.rawResponses.every(r=>r.rawResponse.includes('Synthetic test-only')));
 assert.ok(feedback.rawResponses.every(r=>r.origin==='OPERATOR_TRANSCRIBED_UNATTESTED'));
 assert.ok(feedback.rawResponses.every(r=>r.sessionLabel.startsWith('operator-slot-')));
 for(const field of ['sourceRightsApproved','hostOriginVerified',
   'reviewerIndependenceAuthenticated','fullEightCaseComparisonCompleted',
   'modelInvokedByBrowser','productionEligible'])
  assert.equal(feedback[field],false);
 assert.ok(!Object.hasOwn(feedback,'score'));
 assert.ok(!Object.hasOwn(feedback,'winner'));
 assert.ok(!Object.hasOwn(feedback,'oracle'));
 assert.ok(!Object.hasOwn(feedback.task,'oracle'));
 assert.throws(()=>exportCompletedTrial(packet,work),{code:'BROWSER_INCOMPLETE'});
 await assert.rejects(scorePublicFourArmTrial({responses:feedback}),
  {code:'PUBLIC_TRIAL_RESPONSES'});
});

test('short trial refuses incomplete four-arm evidence and wrong or repeated case identities',()=>{
 const id=packet.tasks[1].id;
 let work=newWorkspace(packet,'claude');
 assert.deepEqual(caseCompletion(packet,work,id),{
  caseId:id,completed:0,total:4,arms:[]
 });
 work=recordAnswer(packet,work,'baseline',id,'Unverified baseline response');
 work=recordAnswer(packet,work,'combined',id,'Unverified combined response');
 assert.equal(caseCompletion(packet,work,id).completed,2);
 assert.throws(()=>exportQuickCaseFeedback(packet,work,id),{
  code:'BROWSER_QUICK_INCOMPLETE'
 });
 assert.throws(()=>caseCompletion(packet,work,'invented'),{code:'BROWSER_CASE'});
 work=recordAnswer(packet,work,'ci_only',id,'Unverified CI response');
 work=recordAnswer(packet,work,'release_only',id,'Unverified release response');
 assert.equal(caseCompletion(packet,work,id).completed,4);
 assert.throws(()=>exportQuickCaseFeedback(packet,work,packet.tasks[0].id),{
  code:'BROWSER_QUICK_INCOMPLETE'
 });
});

test('fixed categorical reviews cannot smuggle identities, injected text, or attestations',()=>{
 const id=packet.tasks[2].id;
 const w=fourReplies(id);
 assert.deepEqual([...QUICK_COMPARISONS],[
  'not-reviewed','combined-better','combined-same','combined-worse','mixed-or-uncertain'
 ]);
 assert.deepEqual([...QUICK_CONCERNS],[
  'not-rated','ci-accuracy','release-accuracy','evidence-grounding',
  'unsafe-instruction','next-checks','answer-length','other'
 ]);
 const raw='SYNTHETIC_PRIVATE_TOKEN_DO_NOT_UPLOAD';
 assert.throws(()=>exportQuickCaseFeedback(packet,w,id,{
  comparison:raw,primaryConcern:'not-rated'
 }),{code:'BROWSER_QUICK_RATING'});
 assert.throws(()=>exportQuickCaseFeedback(packet,w,id,{
  comparison:'combined-better',primaryConcern:raw
 }),{code:'BROWSER_QUICK_RATING'});
 const feedback=exportQuickCaseFeedback(packet,w,id,{
  comparison:'not-reviewed',primaryConcern:'not-rated',
  request:raw,claim:'PRODUCTION_APPROVED',hostIdentity:raw
 });
 assert.equal(JSON.stringify(feedback).includes(raw),false);
 assert.equal(feedback.reportedComparison,'not-reviewed');
 assert.equal(feedback.fullEightCaseComparisonCompleted,false);
 const broken=structuredClone(w);
 broken.previewSha256ByArm.combined='0'.repeat(64);
 assert.throws(()=>exportQuickCaseFeedback(packet,broken,id),{
  code:'BROWSER_WORKSPACE_PIN'
 });
});

test('full eight-case comparison remains a distinct unweakened export gate',async()=>{
 let w=fourReplies(packet.tasks[0].id);
 for(const a of ARM_IDS){
  for(const c of packet.tasks.slice(1)){
   w=recordAnswer(packet,w,a,c.id,'Synthetic offline fixture for '+a+' '+c.id);
  }
 }
 const full=exportCompletedTrial(packet,w);
 assert.equal(full.schema,'qortara/public-four-arm-host-responses/1');
 assert.equal(full.arms.combined.cases.length,8);
 const scored=await scorePublicFourArmTrial({responses:full});
 assert.equal(scored.caseCount,8);
 assert.deepEqual(Object.values(scored.summary).map(x=>x.failed),[8,8,8,8]);
 assert.equal(scored.causalQualityImprovementDemonstrated,false);
});

test('public Pages exposes a clear four-reply, self-reported quality path with no auto-upload',()=>{
 assert.match(html,/id="quick-progress"/);
 assert.match(html,/id="quick-comparison"/);
 assert.match(html,/id="quick-concern"/);
 assert.match(html,/id="export-quick"/);
 assert.match(html,/self-report is not blinded or an independent quality finding/i);
 assert.match(html,/four-reply export is <strong>preliminary feedback only<\/strong>/);
 assert.ok(css.includes('.trial-quick-controls'));
 assert.ok(app.includes('caseCompletion('));
 assert.ok(app.includes('exportQuickCaseFeedback('));
 assert.ok(app.includes('caseSelect.value,'));
 assert.ok(app.includes("for(const id of orderedCases)"),'next slot prioritizes other arms on same case');
 assert.ok(!app.includes('sendBeacon'));
 assert.ok(!app.includes('localStorage'));
 assert.ok(!app.includes('sessionStorage'));
 assert.ok(!app.includes('fetch(')||app.includes("fetch('./four-arm-trial.json'"));
 assert.ok(app.includes("caseSelect.value+'.json'"),'download filename identifies case');
});
