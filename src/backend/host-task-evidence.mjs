/**
 * Offline capture and integrity verification for source-pinned first-party
 * development candidate host-task evaluations. A transcript hash authenticates local bytes only.
 *
 * This module DOES NOT prove the bytes came from ChatGPT/Claude, determine
 * task quality, grant content rights, or install/activate a skill.
 */
import {createHash} from 'node:crypto';
import {canonicalJSON,verifyPackage} from './compose.mjs';
import {PILOT_DEFINITIONS,PILOT_SOURCE_COMMIT} from './first-party-pilots.mjs';

export const HOST_EVIDENCE_SCHEMA='qortara/host-task-evidence/1';
export const HOST_MATRIX_SCHEMA='qortara/host-task-review-matrix/1';
export const HOST_PAIR_SCHEMA='qortara/host-task-pair/1';
export const HOST_TASK_PROVIDERS=Object.freeze(['chatgpt','claude','codex']);
const HASH=/^[0-9a-f]{64}$/;
const LABEL=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
const MAX_BYTES=96*1024;
const SHA=b=>createHash('sha256').update(b).digest('hex');
const REFUSAL=(code,message)=>{
 const err=new Error(message);err.name='HostTaskEvidenceRefusal';err.code=code;throw err;
};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const validHash=x=>typeof x==='string'&&HASH.test(x);
const label=x=>typeof x==='string'&&LABEL.test(x)&&x.length<=160;
const text=x=>typeof x==='string'&&x.length>0&&x.length<=160&&
 x===x.normalize('NFC')&&!/[\u0000-\u001f\u007f]/u.test(x);

function validateHost(host){
 if(!plain(host)||Object.keys(host).sort().join('|')!=='model|observedAt|provider|sessionId'||
  !HOST_TASK_PROVIDERS.includes(host.provider)||!text(host.model)||
  !label(host.sessionId)||typeof host.observedAt!=='string'||
  !UTC.test(host.observedAt)||Number.isNaN(Date.parse(host.observedAt))||
  new Date(host.observedAt).toISOString()!==
  new Date(Date.parse(host.observedAt)).toISOString())
  REFUSAL('HOST_IDENTITY','specific self-reported host, model, session and UTC observation time required');
 // Host identifiers are labels, never cryptographic provider attestations.
 return Object.freeze({...host});
}

function bytes(value,kind,{optional=false}={}){
 if(!Buffer.isBuffer(value)&&!(value instanceof Uint8Array))
  REFUSAL('EVIDENCE_BYTES','real '+kind+' transcript bytes required');
 const b=Buffer.from(value);
 if(b.length>MAX_BYTES||(!optional&&b.length===0))
  REFUSAL('EVIDENCE_BYTES','missing/oversized '+kind+' transcript');
 let s;
 try{s=new TextDecoder('utf-8',{fatal:true}).decode(b);}
 catch{REFUSAL('EVIDENCE_BYTES','invalid UTF-8 in '+kind);}
 if(s.includes('\0')||s.includes('\r')||s!==s.normalize('NFC'))
  REFUSAL('EVIDENCE_BYTES',kind+' must be NFC UTF-8 with LF line endings and no NUL');
 return {sha256:SHA(b),byteLength:b.byteLength};
}

function candidate(packageValue,trustedManifestSha256){
 if(!validHash(trustedManifestSha256))
  REFUSAL('EXTERNAL_PACKAGE_PIN','expected original package hash must be separately supplied');
 const verified=verifyPackage(packageValue);
 if(verified.packageSha256!==trustedManifestSha256)
  REFUSAL('CANDIDATE_CHANGED','sealed candidate differs from independently supplied original hash');
 const files=packageValue.files;
 let sources,receipt,manifest;
 try{
  sources=JSON.parse(files['SOURCES.json']);
  receipt=JSON.parse(files['RECEIPT.json']);
  manifest=JSON.parse(files['skill-mason.json']);
 }catch{REFUSAL('CANDIDATE_SHAPE','candidate JSON is invalid');}
 if(!plain(sources)||!Array.isArray(sources.methods)||sources.methods.length!==1||
  !plain(receipt)||!Array.isArray(receipt.assertions)||receipt.assertions.length!==1||
  receipt.sourceApprovalRequired!==true||receipt.productionEligible!==false||
  receipt.hostValidated!==false||manifest.productionEligible!==false)
  REFUSAL('CANDIDATE_SCOPE','strict unqualified single-method first-party candidate required');
 const src=sources.methods[0],pilot=PILOT_DEFINITIONS.find(x=>x.id===src?.id);
 if(!pilot||src.sha256!==pilot.sha256||src.sourcePath!==pilot.path||
    src.commit!==(pilot.sourceCommit??PILOT_SOURCE_COMMIT)||manifest.name!==pilot.id||
    receipt.assertions[0].methodId!==pilot.id||
    !validHash(receipt.assertions[0].proofDigest)||
    !validHash(receipt.assertions[0].sourceAcceptanceProofSha256))
  REFUSAL('CANDIDATE_SCOPE','original source pins and strict proof references must be preserved');
 return {skillId:pilot.id,originalMethodSha256:pilot.sha256,
  originalSourceCommit:pilot.sourceCommit??PILOT_SOURCE_COMMIT,
  manifestSha256:verified.packageSha256};
}

/**
 * The operator supplies actual task prompt, reference/input and agent response
 * bytes. Nothing here captures a hosted session: all host metadata is
 * UNVERIFIED operator testimony until independently witnessed.
 */
export function captureHostTaskEvidence({
 packageValue,trustedManifestSha256,host,polarity,prompt,reference,response
}={}){
 const origin=candidate(packageValue,trustedManifestSha256);
 const h=validateHost(host);
 if(!['positive','negative'].includes(polarity))
  REFUSAL('SCENARIO','positive or negative control must be explicit');
 const p=bytes(prompt,'prompt'),r=bytes(reference,'reference',{optional:polarity==='negative'});
 const o=bytes(response,'response');
 if(p.byteLength<20)
  REFUSAL('SCENARIO','a meaningful actual host prompt is required');
 return {
  schema:HOST_EVIDENCE_SCHEMA,state:'CAPTURED_UNATTESTED',
  scenario:{skillId:origin.skillId,polarity},
  candidate:origin,
  host:h,
  materials:{prompt:p,reference:r,response:o},
  independentObserverAttested:false,hostOriginCryptographicallyVerified:false,
  behavioralOutcome:'NOT_ADJUDICATED',
  sourceRightsEstablished:false,productionEligible:false,hostValidated:false
 };
}

/** Compare an existing record with independently re-read original raw bytes. */
export function verifyHostTaskEvidence({
 record,packageValue,trustedManifestSha256,prompt,reference,response
}={}){
 if(!plain(record)||record.schema!==HOST_EVIDENCE_SCHEMA||!plain(record.scenario))
  REFUSAL('RECORD_SCHEMA','host task record has no supported schema/scenario');
 const expected=captureHostTaskEvidence({
  packageValue,trustedManifestSha256,host:record.host,
  polarity:record.scenario.polarity,prompt,reference,response
 });
 if(canonicalJSON(record)!==canonicalJSON(expected))
  REFUSAL('RECORD_TAMPERED','record metadata/digests/scope differ from raw transcripts');
 return {
  schema:'qortara/host-task-capture-verification/1',
  state:'CAPTURE_HASHES_MATCH_UNATTESTED',
  scenario:{...expected.scenario},host:{...expected.host},
  manifestSha256:expected.candidate.manifestSha256,
  evidenceRecordSha256:SHA(Buffer.from(canonicalJSON(expected))),
  rawTranscriptBytesMatched:true,
  independentObserverAttested:false,hostOriginCryptographicallyVerified:false,
  behavioralOutcome:'NOT_ADJUDICATED',sourceRightsEstablished:false,
  productionEligible:false,hostValidated:false
 };
}

/**
 * One complete positive + negative trial of an exact source-pinned candidate.
 * This admits newer original methods without weakening the legacy four-case
 * matrix. Re-verifies *each* raw transcript and independently supplied package
 * hash; cannot certify host origin or behavioral success.
 */
export function inspectHostTaskPair(cases){
 if(!Array.isArray(cases)||cases.length!==2)
  REFUSAL('PAIR_INCOMPLETE','one positive and one negative capture are required');
 const results=cases.map(c=>verifyHostTaskEvidence(c));
 const [a,b]=results;
 if(a.scenario.skillId!==b.scenario.skillId ||
    [a.scenario.polarity,b.scenario.polarity].sort().join('|')!=='negative|positive')
  REFUSAL('PAIR_INCOMPLETE','both control polarities must use one exact method');
 if(a.manifestSha256!==b.manifestSha256)
  REFUSAL('PAIR_SCOPE','positive and negative task must use the same sealed candidate');
 if(a.host.provider!==b.host.provider||a.host.model!==b.host.model)
  REFUSAL('PAIR_SCOPE','both controls must use the same reported host and model');
 if(a.host.sessionId===b.host.sessionId)
  REFUSAL('PAIR_DUPLICATE','two distinct host session labels are required');
 return {
  schema:HOST_PAIR_SCHEMA,state:'CAPTURE_PAIR_COMPLETE_AWAITING_INDEPENDENT_REVIEW',
  skillId:a.scenario.skillId,
  manifestSha256:a.manifestSha256,
  reportedHostProvider:a.host.provider,reportedHostModel:a.host.model,
  captures:results.map(r=>({
   polarity:r.scenario.polarity,evidenceRecordSha256:r.evidenceRecordSha256,
   transcriptBytesMatched:r.rawTranscriptBytesMatched
  })).sort((x,y)=>x.polarity.localeCompare(y.polarity)),
  rawTranscriptBytesMatched:true,
  independentObserverAttested:false,hostOriginCryptographicallyVerified:false,
  behavioralOutcome:'NOT_ADJUDICATED',sourceRightsEstablished:false,
  productionEligible:false,hostValidated:false
 };
}

/**
 * Required operator evidence matrix: BOTH original procedures, positive and
 * negative each, on two distinct actual host labels. Structural completeness
 * is NOT proof of a real host session or successful behavior.
 */
export function inspectHostTaskMatrix(cases){
 if(!Array.isArray(cases)||cases.length!==4)
  REFUSAL('MATRIX_INCOMPLETE','exactly four distinct positive/negative task captures required');
 const results=cases.map(c=>verifyHostTaskEvidence(c));
 const expected=[
  'ci-failure-triage:positive','ci-failure-triage:negative',
  'governance-drift-review:positive','governance-drift-review:negative'
 ];
 const keys=results.map(r=>r.scenario.skillId+':'+r.scenario.polarity).sort();
 if(keys.join('|')!==expected.sort().join('|'))
  REFUSAL('MATRIX_INCOMPLETE','both original procedures need positive and negative controls');
 const seenSessions=new Set(results.map(r=>r.host.provider+':'+r.host.sessionId));
 if(seenSessions.size!==4)
  REFUSAL('MATRIX_DUPLICATE','each capture must reference a distinct host session label');
 const bySkill=new Map();
 for(const result of results){
  const prev=bySkill.get(result.scenario.skillId);
  if(prev&&prev.provider!==result.host.provider)
   REFUSAL('MATRIX_SCOPE','positive/negative for a skill must use the same host provider');
  if(prev&&prev.manifestSha256!==result.manifestSha256)
   REFUSAL('MATRIX_SCOPE','positive/negative must exercise an identical candidate digest');
  bySkill.set(result.scenario.skillId,{
   provider:result.host.provider,manifestSha256:result.manifestSha256
  });
 }
 if(new Set([...bySkill.values()].map(x=>x.provider)).size!==2)
  REFUSAL('MATRIX_SCOPE','two different host providers required for two task journeys');
 return {
  schema:HOST_MATRIX_SCHEMA,state:'CAPTURE_MATRIX_COMPLETE_AWAITING_INDEPENDENT_REVIEW',
  captures:results.map(r=>({
   skillId:r.scenario.skillId,polarity:r.scenario.polarity,
   provider:r.host.provider,manifestSha256:r.manifestSha256,
   evidenceRecordSha256:r.evidenceRecordSha256
  })).sort((a,b)=>(a.skillId+':'+a.polarity).localeCompare(b.skillId+':'+b.polarity)),
  rawTranscriptBytesMatched:true,independentObserverAttested:false,
  hostOriginCryptographicallyVerified:false,
  behavioralOutcome:'NOT_ADJUDICATED',
  sourceRightsEstablished:false,productionEligible:false,hostValidated:false
 };
}
