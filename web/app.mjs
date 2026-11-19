import {buildStarter} from './src/starter.mjs';
import {buildFeedbackReport} from './src/trial-feedback.mjs';
import {startPrismMotion} from './src/prism-motion.mjs';
import {openHolo,runGuest,runFixtures,WebError} from './src/core.mjs';
import {CASES} from './src/fixtures.mjs';
import {load} from 'prism-code';

const el=id=>document.getElementById(id);
const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
const motion=startPrismMotion(el('prism-visual'),el('verdant-canvas'),window);
void motion.initialize();
const form=el('skill-form'),request=el('skill-request'),generate=el('generate');
const status=el('request-status'),caption=el('motion-caption'),panel=el('result-panel');
const trialPanel=el('trial-panel'),trialStatus=el('trial-feedback-status');
let currentDraft=null;
function state(s,label){motion.setState(s);caption.textContent=label;}
function download(text,filename,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelectorAll('[data-example]').forEach(item=>item.addEventListener('click',()=>{
 request.value=item.dataset.example;request.focus();
}));
request.addEventListener('input',()=>{
 status.dataset.error='false';status.textContent='Ready to create a starter draft.';
 if(!currentDraft)state('idle','Request → Prism → skill draft');
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(generate.disabled)return;generate.disabled=true;
 state('working','Formatting your starter draft');status.dataset.error='false';
 status.textContent='Preparing a starter locally…';panel.hidden=true;
 try{
  // Template-based request formatting, NOT Prism guest execution.
  const draft=buildStarter(request.value);
  if(!reduceMotion)await new Promise(resolve=>setTimeout(resolve,420));
  currentDraft=draft;el('skill-preview').textContent=draft.markdown;
  el('result-title').textContent='Your starter skill';panel.hidden=false;
  trialPanel.hidden=false;trialStatus.textContent='Choose the observed result; save the feedback file locally before sharing.';
  state('draft','Starter draft ready');
  status.textContent='Draft created. Review and download SKILL.md.';
  panel.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'nearest'});
 }catch(err){
  currentDraft=null;panel.hidden=true;trialPanel.hidden=true;
  state('refused','More detail needed');
  status.dataset.error='true';status.textContent=err?.message??'Unable to make a draft.';
 }finally{generate.disabled=false;}
});
el('download-skill').addEventListener('click',()=>{
 if(currentDraft)download(currentDraft.markdown+'\n','SKILL.md','text/markdown;charset=utf-8');
});
el('copy-skill').addEventListener('click',async()=>{
 if(!currentDraft)return;
 try{await navigator.clipboard.writeText(currentDraft.markdown);status.textContent='Copied starter draft.';}
 catch{status.textContent='Use Download SKILL.md if clipboard is unavailable.';}
});

// Public trial feedback is a local-only, fixed-choice report. No user prompt,
// draft text, model response or credential is included or posted by this page.
el('download-feedback').addEventListener('click',()=>{
 if(!currentDraft)return;
 try{
  const report=buildFeedbackReport({
   host:el('feedback-host').value,
   outcome:el('feedback-outcome').value,
   gap:el('feedback-gap').value
  });
  download(JSON.stringify(report,null,2)+'\\n','qortara-starter-trial-feedback.json','application/json');
  trialStatus.textContent='Feedback file saved locally. You choose whether to share it on GitHub.';
 }catch(err){trialStatus.textContent=err?.message??'Could not export feedback.';}
});

// Engineer-only diagnostics. This does not gate the user-request starter draft.
const dev={file:el('holo'),sha:el('sha'),consent:el('consent'),verify:el('verify'),
 evaluate:el('evaluate'),vectors:el('vectors'),request:el('request'),state:el('state'),
 output:el('output'),meta:el('meta'),save:el('save')};
let session=null,report=null,busy=false;
function devOutput(x){report=x;dev.output.textContent=JSON.stringify(x,null,2);dev.save.disabled=!x;}
function devReset(){
 session=null;dev.evaluate.disabled=dev.vectors.disabled=true;
 dev.state.textContent='No Prism artifact verified.';dev.state.dataset.error='false';
 dev.meta.textContent='No artifact verified · No native execution';
 devOutput({state:'NOT_RUN',productionEligible:false});
}
function devError(err){
 dev.state.dataset.error='true';dev.state.textContent='Refused: '+String(err?.message??'Unknown error');
 devOutput({schema:'qortara/pages-error/1',state:'REFUSED',code:err?.code??'WEB_ERROR',productionEligible:false});
}
async function devAct(fn){
 if(busy)return;busy=true;dev.verify.disabled=dev.evaluate.disabled=dev.vectors.disabled=true;
 try{await fn();}catch(err){devError(err);}
 finally{busy=false;dev.verify.disabled=false;dev.evaluate.disabled=dev.vectors.disabled=!session;}
}
for(const node of [dev.file,dev.sha,dev.consent])
 node.addEventListener(node===dev.sha?'input':'change',devReset);
dev.verify.addEventListener('click',()=>devAct(async()=>{
 if(!dev.consent.checked)throw new WebError('ASSURANCE_HOLD','Acknowledge the P0 development-only limit.');
 const file=dev.file.files?.[0];
 if(!file)throw new WebError('HOLO_REQUIRED','Choose a real native-built .holo.');
 dev.state.textContent='Verifying actual artifact and policy…';
 session=await openHolo(file,dev.sha.value.trim(),load);
 dev.state.textContent='Prism P0 fixture verified for local testing.';dev.state.dataset.error='false';
 dev.meta.textContent='SHA-256: '+session.identity.sha256+' · Level: '+session.identity.assurance;
 devOutput({schema:'qortara/pages-artifact/1',artifact:session.identity,verdict:session.verdict,
  readyForFixtureTest:true,productionEligible:false});
}));
document.querySelectorAll('[data-hex]').forEach(node=>node.addEventListener('click',()=>{dev.request.value=node.dataset.hex;}));
dev.evaluate.addEventListener('click',()=>devAct(async()=>{
 if(!session)throw new WebError('NOT_READY','Verify a real holo first.');
 devOutput({schema:'qortara/pages-result/1',artifact:session.identity,...await runGuest(session,dev.request.value.trim())});
}));
dev.vectors.addEventListener('click',()=>devAct(async()=>{
 if(!session)throw new WebError('NOT_READY','Verify a real holo first.');
 devOutput(await runFixtures(session,CASES));
}));
dev.save.addEventListener('click',()=>{
 if(report)download(JSON.stringify(report,null,2)+'\n','qortara-prism-diagnostic.json','application/json');
});
devReset();
