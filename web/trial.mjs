import {
 ARM_IDS,BROWSER_WORKSPACE_SCHEMA,
 validateTrialPacket,newWorkspace,validateWorkspace,
 formatTrialPrompt,recordAnswer,removeAnswer,trialProgress,
 exportCompletedTrial
} from './src/four-arm-browser.mjs';

const el=id=>document.getElementById(id);
const host=el('trial-host'),arm=el('trial-arm'),caseSelect=el('trial-case');
const prompt=el('trial-prompt'),response=el('trial-response');
const status=el('trial-state'),slotLabel=el('slot-label');
const exportProgress=el('export-progress'),exportComplete=el('export-complete');
const progress=el('trial-progress'),progressLabel=el('progress-label');
const importProgress=el('import-progress');
let packet=null,workspace=null;

function inform(message,error=false){
 status.dataset.error=String(error);
 status.textContent=message;
}
function saveDownload(body,filename){
 const blob=new Blob([body],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function current(){
 return workspace?.records.find(x=>x.arm===arm.value&&x.caseId===caseSelect.value);
}
function advance(){
 for(const a of ARM_IDS){
  for(const task of packet.tasks){
   if(!workspace.records.some(r=>r.arm===a&&r.caseId===task.id)){
    arm.value=a;caseSelect.value=task.id;refresh();
    inform('Next unrecorded slot selected. Use a fresh agent session.');
    return;
   }
  }
 }
 inform('All 32 response slots recorded. Export them for offline comparison.');
}
function refresh(){
 if(!packet||!workspace)return;
 const c=current();
 prompt.value=formatTrialPrompt(packet,arm.value,caseSelect.value);
 response.value=c?.rawResponse??'';
 slotLabel.textContent=c?'Recorded locally':'Not recorded';
 const state=trialProgress(packet,workspace);
 progress.value=state.completed;
 progressLabel.textContent=state.completed+' of '+state.total+' trial slots recorded';
 host.disabled=state.completed>0;
 response.disabled=false;
 el('copy-prompt').disabled=false;
 el('save-answer').disabled=false;
 el('remove-answer').disabled=!c;
 el('next-slot').disabled=state.completed===state.total;
 exportProgress.disabled=false;
 exportComplete.disabled=state.completed!==state.total;
 el('trial-version').textContent='Source snapshot SHA-256: '+
  packet.corpusSourceSnapshotSha256+
  ' · Current arm instruction SHA-256: '+
  (arm.value==='baseline'?'NO_SKILL':packet.arms[arm.value].contentSha256);
}
async function startup(){
 try{
  const request=await fetch('./four-arm-trial.json',{cache:'no-store'});
  if(!request.ok)throw Error('Source-pinned trial packet is not available on this deployment.');
  const raw=await request.text();
  if(raw.length>500_000)throw Error('Source trial packet exceeds safety bounds.');
  packet=validateTrialPacket(JSON.parse(raw));
  workspace=newWorkspace(packet,host.value);
  for(const task of packet.tasks){
   const opt=document.createElement('option');
   opt.value=task.id;
   opt.textContent=task.id.replaceAll('-',' ');
   caseSelect.append(opt);
  }
  refresh();
  inform('Trial ready. Copy the first task into a new tool-disabled agent session.');
 }catch(err){
  inform(err?.message??'Unable to load the trial packet.',true);
  for(const x of ['copy-prompt','save-answer','remove-answer','next-slot',
   'export-progress','export-complete'])el(x).disabled=true;
 }
}
host.addEventListener('change',()=>{
 if(!packet)return;
 if(workspace.records.length>0){
  host.value=workspace.hostLabel;
  inform('Host is locked after the first recorded reply. Export the current trial before switching hosts.',true);
  return;
 }
 workspace=newWorkspace(packet,host.value);
 refresh();
});
for(const control of [arm,caseSelect])control.addEventListener('change',()=>{
 if(packet){refresh();inform('Selected slot ready. Only fresh host sessions support a fair comparison.');}
});
el('copy-prompt').addEventListener('click',async()=>{
 if(!packet)return;
 try{
  await navigator.clipboard.writeText(prompt.value);
  inform('Full original trial prompt copied. Paste into a fresh tool-disabled session.');
 }catch{
  prompt.focus();prompt.select();
  inform('Clipboard permission unavailable. The full prompt is selected for manual copying.',true);
 }
});
el('save-answer').addEventListener('click',()=>{
 if(!packet)return;
 try{
  workspace=recordAnswer(packet,workspace,arm.value,caseSelect.value,response.value);
  refresh();
  inform('Unedited answer recorded locally. No transcript was uploaded.');
 }catch(err){inform(err.message,true);}
});
el('remove-answer').addEventListener('click',()=>{
 if(!packet)return;
 workspace=removeAnswer(packet,workspace,arm.value,caseSelect.value);
 refresh();
 inform('Selected reply cleared from this local workspace.');
});
el('next-slot').addEventListener('click',()=>{if(packet)advance();});
exportProgress.addEventListener('click',()=>{
 if(!packet)return;
 try{
  validateWorkspace(packet,workspace);
  saveDownload(JSON.stringify(workspace,null,2)+'\n','qortara-four-arm-progress.json');
  inform('Saved local progress. This file contains your raw replies; review it before sharing.');
 }catch(err){inform(err.message,true);}
});
exportComplete.addEventListener('click',()=>{
 if(!packet)return;
 try{
  const result=exportCompletedTrial(packet,workspace);
  saveDownload(JSON.stringify(result,null,2)+'\n','qortara-four-arm-recorded-responses.json');
  inform('All 32 raw replies exported. Run the offline lexical scorer and blind evidence-grounded review; no automatic scoring or uploads occurred.');
 }catch(err){inform(err.message,true);}
});
importProgress.addEventListener('change',async()=>{
 if(!packet)return;
 const file=importProgress.files?.[0];
 if(!file)return;
 try{
  if(file.size<1||file.size>1_000_000)
   throw Error('Progress JSON must be an ordinary file smaller than 1 MB.');
  const data=JSON.parse(await file.text());
  if(data?.schema!==BROWSER_WORKSPACE_SCHEMA)
   throw Error('This is not a saved four-arm browser workspace.');
  workspace=validateWorkspace(packet,data);
  host.value=workspace.hostLabel;
  refresh();
  inform('Saved progress restored locally: '+workspace.records.length+' of 32 replies. No file was uploaded.');
 }catch(err){inform(err.message??'Invalid progress file.',true);}
 finally{importProgress.value='';}
});
void startup();
