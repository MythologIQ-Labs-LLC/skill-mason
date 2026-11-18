/**
 * Qortara Skills visual: a tiny, locally vendored Verdant Engine WebGL2 scene.
 *
 * STRICT BOUNDARY: This is presentation only. It neither verifies Prism,
 * selects a source method, nor computes skill eligibility. Animation reflects
 * caller-observed states (idle, working, draft, refused).
 *
 * Uses pinned Verdant scene renderer: afflom/verdant-engine
 * c21176cf24c51d9a0de07f649cefe2ee4b522093.
 */
import {createGlRenderer,mat4Perspective,mat4LookAt,mat4Mul}
  from '../vendor/verdant/scene-renderer.mjs';

export const MOTION_STATES=Object.freeze(['idle','working','draft','refused']);
export function validateMotionState(state){
 if(!MOTION_STATES.includes(state))throw Error('Invalid visual state: '+state);
 return state;
}
const palette=[
 [0.52,0.75,0.98],
 [0.33,0.48,0.78],
 [0.28,0.54,0.82],
 [0.53,0.76,0.96],
 [0.41,0.64,0.88]
];
const point=(x,y,z,angle)=>{
 const a=angle,b=-0.14+Math.sin(angle*0.55)*0.13;
 const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 const X=x*ca+z*sa,Z=z*ca-x*sa;
 return [X,y*cb-Z*sb,y*sb+Z*cb];
};
const normal=(a,b,c)=>{
 const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const x=u[1]*v[2]-u[2]*v[1],y=u[2]*v[0]-u[0]*v[2],z=u[0]*v[1]-u[1]*v[0];
 const l=Math.hypot(x,y,z)||1;
 return [x/l,y/l,z/l];
};
export function createPrismMesh(angle=0){
 const f=[[0,1.08,-0.47],[-0.99,-0.65,-0.47],[0.99,-0.65,-0.47]];
 const back=f.map(([x,y])=>[x,y,0.47]);
 const faces=[
  [f[0],f[2],f[1]], [back[0],back[1],back[2]],
  [f[0],f[1],back[1]],[f[0],back[1],back[0]],
  [f[0],back[0],back[2]],[f[0],back[2],f[2]],
  [f[1],f[2],back[2]],[f[1],back[2],back[1]]
 ];
 const colors=[palette[0],palette[1],palette[2],palette[2],palette[3],palette[3],palette[4],palette[4]];
 const pos=[],norm=[],col=[],idx=[];
 for(let i=0;i<faces.length;i++){
   const tri=faces[i].map(v=>point(v[0],v[1],v[2],angle));
   const n=normal(...tri), rgb=colors[i];
   for(const vertex of tri){
     pos.push(...vertex);norm.push(...n);col.push(...rgb);idx.push(idx.length);
   }
 }
 return {pos:new Float32Array(pos),norm:new Float32Array(norm),
   col:new Float32Array(col),idx:new Uint32Array(idx)};
}
export function startPrismMotion(element,canvas,win=globalThis){
 let visualState='idle',running=false,frame=0,last=0,renderer=null;
 const reduce=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const setState=(state)=>{
   visualState=validateMotionState(state);
   element.dataset.state=state;
 };
 const stop=()=>{running=false;if(frame)win.cancelAnimationFrame?.(frame);frame=0;};
 const updateCanvas=()=>{
   const rect=canvas.getBoundingClientRect();
   const dpr=Math.min(1.5,win.devicePixelRatio||1);
   const width=Math.max(1,Math.min(900,Math.round(rect.width*dpr)));
   const height=Math.max(1,Math.min(640,Math.round(rect.height*dpr)));
   if(canvas.width!==width)canvas.width=width;
   if(canvas.height!==height)canvas.height=height;
 };
 const tick=(time)=>{
   if(!running)return;
   frame=win.requestAnimationFrame(tick);
   if(time-last<42)return;last=time;
   if(win.document?.hidden)return;
   updateCanvas();
   const w=canvas.width,h=canvas.height,scale=w/h;
   const eye=[0,0.2,4.6];
   const mvp=mat4Mul(mat4Perspective(Math.PI/3.5,scale,0.1,40),
     mat4LookAt(eye,[0,0,0],[0,1,0]));
   const speed=visualState==='working'?1.25:0.32;
   const angle=time*0.001*speed;
   const mesh=createPrismMesh(angle);
   renderer.uploadPackedBuffers(mesh.pos,mesh.norm,mesh.col,mesh.idx);
   renderer.render(mvp,eye,{
     rank:1,sky:[0.04,0.10,0.20],fog:[0.06,0.14,0.29]
   },time/1000,[0,0,0]);
 };
 // Never allocate a GPU context if user asked for reduced motion. CSS still
 // conveys the honest state with labels and static graphic.
 const initialize=async()=>{
   if(reduce||!canvas?.getContext||!win.requestAnimationFrame)return false;
   try{
     renderer=await createGlRenderer(canvas);
     if(!renderer)return false;
     element.dataset.engine='verdant';
     running=true;frame=win.requestAnimationFrame(tick);
     return true;
   }catch{return false;}
 };
 return {initialize,setState,stop,getState:()=>visualState,getEngine:()=>renderer?.backend??'css-fallback'};
}
