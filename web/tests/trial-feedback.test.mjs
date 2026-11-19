import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFeedbackReport,HOSTS,OUTCOMES,GAPS,FEEDBACK_SCHEMA}
 from '../src/trial-feedback.mjs';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const selection={host:'browser-only',outcome:'not-tested-in-host',gap:'not-rated'};

test('local feedback records only explicit categorical self-reported values',()=>{
 const report=buildFeedbackReport(selection);
 assert.equal(report.schema,FEEDBACK_SCHEMA);
 assert.equal(report.trial,'browser-starter-template-only');
 assert.equal(report.declaredHost,'browser-only');
 assert.equal(report.reportedOutcome,'not-tested-in-host');
 assert.equal(report.evidenceClass,'SELF_REPORTED_NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(report.uploadedBySite,false);
 assert.equal(report.hasRequestText,false);
 assert.equal(report.hasGeneratedSkillText,false);
 assert.equal(report.hasModelTranscript,false);
 assert.deepEqual(buildFeedbackReport(selection),report);
});
test('raw prompts, private logs, generated skills and arbitrary properties cannot leak into export',()=>{
 const canaries=['FAKE_PRIVATE_TOKEN_NEVER_UPLOAD','FAKE_USER_EMAIL@example.invalid',
  'FAKE_INTERNAL_CI_LOG_NEVER_UPLOAD','FAKE_SKILL_MARKDOWN_NEVER_UPLOAD'];
 const unsafe={...selection,
  request:canaries[0],privateLog:canaries[2],generatedSkill:canaries[3],
  browserAgent:'Mozilla/5.0 '+canaries[1],notes:canaries.join(' '),transcript:canaries[0]};
 const output=JSON.stringify(buildFeedbackReport(unsafe));
 for(const value of canaries)assert.equal(output.includes(value),false,value);
 assert.deepEqual(Object.keys(buildFeedbackReport(unsafe)).sort(),
  Object.keys(buildFeedbackReport(selection)).sort());
});
test('unrecognized choices cannot inject free text into a declared category',()=>{
 for(const host of ['fake host with email foo@example.invalid','',null])
  assert.throws(()=>buildFeedbackReport({...selection,host}),TypeError);
 for(const outcome of ['model succeeded in production','',undefined])
  assert.throws(()=>buildFeedbackReport({...selection,outcome}),TypeError);
 for(const gap of ['source=secret','',null])
  assert.throws(()=>buildFeedbackReport({...selection,gap}),TypeError);
 assert.equal(HOSTS.length,5);assert.equal(OUTCOMES.length,5);assert.equal(GAPS.length,6);
});
test('the public page keeps trial paths separate and only activates feedback after draft creation',()=>{
 assert.match(html,/id="trial-panel"[^>]+hidden/);
 assert.match(html,/id="feedback-host"/);
 assert.match(html,/id="feedback-outcome"/);
 assert.match(html,/id="feedback-gap"/);
 assert.match(html,/id="download-feedback"/);
 assert.match(html,/trials\/ci-failure-triage-v5/);
 assert.match(html,/issues\/new\?template=skill-trial-feedback\.yml/);
 assert.ok(html.indexOf('id="result-panel"')<html.indexOf('id="trial-panel"'));
 assert.match(app,/buildFeedbackReport\(/);
 assert.match(app,/trialPanel\.hidden=false/);
 assert.match(app,/trialPanel\.hidden=true/);
 assert.match(app,/download\(JSON\.stringify\(report/);
 assert.doesNotMatch(app,/fetch\([^\n]*feedback/i);
 assert.doesNotMatch(app,/sendBeacon/i);
});

test('downloaded feedback is syntactically valid JSON with no literal escape suffix',()=>{
 const needle="download(JSON.stringify(report,null,2)+";
 const start=app.indexOf(needle);
 assert.ok(start>=0,'JSON download call exists');
 const tail=app.slice(start+needle.length);
 assert.equal(tail[0],"'");
 const ending=tail.indexOf("'",1);
 assert.ok(ending>1);
 assert.deepEqual([...tail.slice(1,ending)].map(x=>x.charCodeAt(0)),[92,110],
  'the source must append an actual newline using a single JavaScript escape');
});
