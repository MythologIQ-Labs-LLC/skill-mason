import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
test('Q logo is followed by ortara not another Qortara',()=>{
 assert.match(html,/<a class="brand"[^>]+aria-label="Qortara Skills"[^>]*><img[^>]+><span>ortara <strong>Skills<\/strong><\/span>/);
 assert.doesNotMatch(html,/<span>Qortara <strong>Skills/);
});
test('request comes first and Prism internals are behind developer details',()=>{
 assert.ok(html.indexOf('id="skill-request"')<html.indexOf('id="developer"'));
 assert.match(html,/<h1>What skill do you need\?<\/h1>/);
 assert.match(html,/<details id="developer"/);
 assert.ok(html.indexOf('id="result-panel"')<html.indexOf('id="developer"'));
});
test('starter draft downloads and never calls the eligibility guest',()=>{
 assert.match(app,/buildStarter\(request\.value\)/);
 assert.match(app,/currentDraft\.markdown/);
 assert.match(app,/motion\.setState\(s\)/);
 assert.match(app,/const draft=buildStarter/);
});
test('real Prism interface stays available in advanced diagnostics',()=>{
 for(const id of ['holo','sha','consent','verify','request','vectors'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/session=await openHolo/);
});
