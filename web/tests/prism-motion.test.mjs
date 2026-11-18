import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrismMesh,validateMotionState,MOTION_STATES} from '../src/prism-motion.mjs';
test('Prism geometry uses the actual Verdant renderer-compatible typed arrays',()=>{
 const a=createPrismMesh(0),b=createPrismMesh(1.3);
 assert.equal(a.pos.length,24*3);
 assert.equal(a.norm.length,a.pos.length);
 assert.equal(a.col.length,a.pos.length);
 assert.equal(a.idx.length,24);
 assert.equal(a.pos instanceof Float32Array,true);
 assert.equal(a.idx instanceof Uint32Array,true);
 assert.notDeepEqual([...a.pos],[...b.pos]);
 assert.ok([...a.pos,...a.norm,...a.col].every(Number.isFinite));
});
test('animation states are bound to actual outcome and refuse invented success',()=>{
 assert.deepEqual(MOTION_STATES,['idle','working','draft','refused']);
 for(const s of MOTION_STATES)assert.equal(validateMotionState(s),s);
 assert.throws(()=>validateMotionState('qualified'),/Invalid visual state/);
 assert.throws(()=>validateMotionState('published'),/Invalid visual state/);
});
