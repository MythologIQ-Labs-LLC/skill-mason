import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');

test('full Qortara banner stays contained in the new hero, not cropped as a strip',()=>{
  assert.match(html,/<section class="intro" aria-label="About Qortara Skills">/);
  assert.match(html,/<div class="intro-brand">\s*<img src="\.\/assets\/qortara-skills-banner\.webp"/);
  assert.match(css,/\.intro-brand img\{[^}]*object-fit:contain/);
  assert.doesNotMatch(html,/class="brand-banner"/);
});

test('visual hierarchy retains the task-first form, output, and gated developer tools',()=>{
  assert.match(html,/<h1>What skill do you need\?<\/h1>/);
  assert.match(html,/id="skill-form"/);
  assert.match(html,/id="result-panel" hidden/);
  assert.match(html,/<details id="developer"/);
  assert.ok(html.indexOf('id="skill-form"')<html.indexOf('id="developer"'));
  assert.ok(html.indexOf('id="prism-visual"')<html.indexOf('id="developer"'));
  assert.match(html,/LOCAL PREVIEW/);
  assert.doesNotMatch(html,/PRODUCTION VERIFIED|QUALIFIED OUTPUT/);
});

test('tablet and phone breakpoints make the workspace one column without extra libraries',()=>{
  assert.match(css,/@media\(max-width:980px\)\{\s*\.workspace\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/@media\(max-width:690px\)\{/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(html,/https?:\/\/[^"]+\.(?:woff|ttf|css)/);
});

test('Q icon and ortara form a single wordmark with a distinct Skills gap',()=>{
  assert.ok(html.includes('<span>ortara <strong>Skills</strong></span>'));
  assert.ok(css.includes('.brand{gap:0;font-size:21px'));
  assert.ok(css.includes('.brand>span{display:inline-flex;align-items:baseline;gap:10px;margin-left:-1px}'));
  assert.ok(css.includes('.brand{font-size:19px;gap:0}'));
  assert.ok(!html.includes('<span>Qortara <strong>Skills'));
});
