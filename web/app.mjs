import {openHolo,runGuest,runFixtures,WebError} from './src/core.mjs';
import {CASES} from './src/fixtures.mjs';
import {load} from 'prism-code';
const el=id=>document.getElementById(id);
const ui={file:el('holo'),sha:el('sha'),consent:el('consent'),verify:el('verify'),
  evaluate:el('evaluate'),vectors:el('vectors'),request:el('request'),
  state:el('state'),output:el('output'),meta:el('meta'),save:el('save')};
let session=null,report=null,busy=false;
function output(x){report=x;ui.output.textContent=JSON.stringify(x,null,2);ui.save.disabled=!x;}
function reset(){
 session=null;ui.evaluate.disabled=true;ui.vectors.disabled=true;ui.save.disabled=true;
 ui.meta.textContent='No artifact verified · No runtime evidence';
 ui.state.textContent='No verified artifact loaded. Real holo required.';
 ui.state.dataset.error='false';ui.state.dataset.ready='false';
 output({state:'NOT_RUN',productionEligible:false});
}
function error(e){
 ui.state.dataset.error='true';ui.state.dataset.ready='false';
 ui.state.textContent='Refused: '+String(e?.message??'Unknown error');
 output({schema:'qortara/pages-error/1',state:'REFUSED',code:e?.code??'WEB_ERROR',productionEligible:false});
}
async function act(fn){
 if(busy)return;busy=true;ui.verify.disabled=true;ui.evaluate.disabled=true;ui.vectors.disabled=true;
 try{await fn()}catch(e){error(e)}
 finally{busy=false;ui.verify.disabled=false;ui.evaluate.disabled=!session;ui.vectors.disabled=!session}
}
for(const item of [ui.file,ui.sha,ui.consent])
 item.addEventListener(item===ui.sha?'input':'change',reset);
ui.verify.addEventListener('click',()=>act(async()=>{
 if(!ui.consent.checked)throw new WebError('ASSURANCE_HOLD','Check the P0 development-only acknowledgment first.');
 const file=ui.file.files?.[0];
 if(!file)throw new WebError('HOLO_REQUIRED','Select a genuine native-built Prism .holo.');
 ui.state.textContent='Verifying exact SHA-256, application identity and Prism policy…';
 session=await openHolo(file,ui.sha.value.trim(),load);
 ui.state.textContent='Real Prism holo verified under P0 pure-world fixture policy. Ready for local test.';
 ui.state.dataset.ready='true';ui.state.dataset.error='false';
 ui.meta.textContent='Artifact: '+session.identity.sha256.slice(0,20)+'… · Assurance: '+session.identity.assurance;
 output({schema:'qortara/pages-artifact/1',artifact:session.identity,
   verdict:session.verdict,productionEligible:false,readyForFixtureTest:true});
}));
document.querySelectorAll('[data-hex]').forEach(b=>b.addEventListener('click',()=>{ui.request.value=b.dataset.hex}));
ui.evaluate.addEventListener('click',()=>act(async()=>{
 if(!session)throw new WebError('NOT_READY','Verify a genuine holo first.');
 const result=await runGuest(session,ui.request.value.trim());
 output({schema:'qortara/pages-result/1',artifact:session.identity,...result});
}));
ui.vectors.addEventListener('click',()=>act(async()=>{
 if(!session)throw new WebError('NOT_READY','Verify a genuine holo first.');
 output(await runFixtures(session,CASES));
}));
ui.save.addEventListener('click',()=>{
 if(!report)return;
 const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='qortara-skills-local-report.json';
 link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
reset();
