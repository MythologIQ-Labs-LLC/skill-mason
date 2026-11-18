import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStarter,normalizeRequest,slugFromRequest,DraftError,safeMd} from '../src/starter.mjs';
test('builds downloadable SKILL.md from a user request',()=>{
 const r=buildStarter('Create a skill that summarizes changelogs into a release briefing');
 assert.equal(r.filename,'SKILL.md');
 assert.match(r.markdown,/^---\nname: [a-z0-9-]+\n/m);
 assert.match(r.markdown,/## Intended outcome/);
 assert.match(r.markdown,/summarizes changelogs into a release briefing/);
 assert.equal(r.qualified,false);
 assert.equal(r.prismEvaluated,false);
 assert.equal(r.hostValidated,false);
 assert.equal(r.modelCallsMeasured,false);
});
test('same request gives byte-identical deterministic content',()=>{
 const text='Summarize a pull request with test results and outstanding risks';
 assert.deepEqual(buildStarter(text),buildStarter(text));
});
test('no counterfeit expertise, approvals or qualified source method claims',()=>{
 const r=buildStarter('Review a user-provided contract and identify the open questions');
 assert.match(r.markdown,/qualified or behaviorally tested skill/);
 assert.match(r.markdown,/do not invent expertise/);
 assert.equal(r.sourceMethods,0);
});
test('rejects missing short malformed and long requests',()=>{
 for(const input of [null,'','Need a skill','abcd','a b c','Need a \u0000 skill for this','word '.repeat(300)])
   assert.throws(()=>buildStarter(input),DraftError);
});
test('escapes html and markdown in untrusted user text',()=>{
 const r=buildStarter('Summarize <script>alert(1)</script> and # dangerous [links](xyz)');
 assert.match(r.markdown,/\\<script\\>/);
 assert.doesNotMatch(r.markdown,/\nname: dangerous/);
 assert.equal((r.markdown.match(/^---$/gm)??[]).length,2);
});
test('slug is safe as portable host id',()=>{
 assert.match(slugFromRequest('Document API failures in a user-controlled folder'),/^[a-z0-9-]+$/);
 assert.equal(slugFromRequest('Handle 123 unknown inputs for this request').includes('/'),false);
});
test('Unicode normalization is deterministic',()=>{
 assert.equal(normalizeRequest('Make a skill to review cache\u0301 updates'),
   normalizeRequest('Make a skill to review cach\u00e9 updates'));
});
test('plain-text escapes unsafe HTML delimiters',()=>{
 assert.equal(safeMd('Hello <img src=x>'),'Hello \\<img src=x\\>');
});
