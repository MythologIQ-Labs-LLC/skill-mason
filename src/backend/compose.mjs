/**
 * Deterministic skill package composer. DEVELOPMENT CONTRACT ONLY.
 * Assertion and Prism adapters MUST be supplied by a trusted coordinator,
 * not from user-controlled recipe fields or catalog claims.
 * In-memory composition performs no network, model inference, or host actions.
 */
import {createHash} from 'node:crypto';
import {mkdir,open,lstat,readdir,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,basename,dirname,parse,relative,join,sep} from 'node:path';
import {parseTextProcedure,PROCEDURE_VERSION} from './text-procedure.mjs';

export const PACKAGE_SCHEMA='qortara/skill-package-candidate/1';
export class CompositionRefusal extends Error {
  constructor(code,message){super(message);this.name='CompositionRefusal';this.code=code;}
}
function refuse(code,message){throw new CompositionRefusal(code,message);}
const hex64=/^[a-f0-9]{64}$/;
// Agent Skills name: 1-64 lowercase letters/numbers/hyphens, no double or trailing hyphen.
const slug=/^(?!.*--)[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const commit=/^[0-9a-f]{40}$/;
const safePath=/^[a-zA-Z0-9._/-]{1,160}$/;
const SHA=b=>createHash('sha256').update(b).digest('hex');
const utf8=x=>Buffer.from(x,'utf8');
function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function boundedString(x,field,max=160){
  if(typeof x!=='string'||x.length<1||x.length>max||x!==x.normalize('NFC')||/[\u0000-\u001f\u007f]/u.test(x))
    refuse('INVALID_INPUT',field+' must be bounded NFC text without controls');
  return x;
}
function canonicalize(v){
  if(Array.isArray(v))return v.map(canonicalize);
  if(obj(v))return Object.fromEntries(Object.keys(v).sort().map(k=>{
    if(k==='__proto__'||k==='constructor'||k==='prototype')refuse('INVALID_INPUT','unsafe object key');
    return [k,canonicalize(v[k])];
  }));
  if(typeof v==='string')return boundedString(v,'canonical string',400_000);
  if(v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isSafeInteger(v)))return v;
  refuse('INVALID_INPUT','unsupported canonical type');
}
export function canonicalJSON(v){return JSON.stringify(canonicalize(v))+'\n';}
const digestJSON=v=>SHA(utf8(canonicalJSON(v)));
function validateRecipe(recipe){
  if(!obj(recipe)||recipe.schema!=='qortara/internal-composition-plan/1')refuse('INVALID_RECIPE','unsupported recipe schema');
  if(typeof recipe.name!=='string'||!slug.test(recipe.name))refuse('INVALID_RECIPE','invalid package name');
  for(const name of ['title','description','targetHost'])boundedString(recipe[name],name,name==='description'?400:150);
  if(!Array.isArray(recipe.requiredOutcomes)||recipe.requiredOutcomes.length===0||recipe.requiredOutcomes.length>32)
    refuse('INVALID_RECIPE','required outcomes must be a bounded nonempty list');
  const out=recipe.requiredOutcomes.map(v=>boundedString(v,'required outcome',160));
  if(new Set(out).size!==out.length)refuse('INVALID_RECIPE','duplicate outcome');
  if(recipe.network!==false||recipe.secrets!==false||recipe.execution!==false)
    refuse('AUTHORITY_EXCEEDED','first slice cannot request network, secrets or execution');
  const allowed=new Set(['schema','name','title','description','targetHost','requiredOutcomes','network','secrets','execution','sourceSnapshot','packagePins']);
  if(Object.keys(recipe).some(k=>!allowed.has(k)))refuse('INVALID_RECIPE','unrecognized recipe field');
  if((recipe.sourceSnapshot===undefined)!==(recipe.packagePins===undefined))
    refuse('SOURCE_PIN','snapshot and package pins must be declared together');
  let sourceSnapshot,packagePins;
  if(recipe.sourceSnapshot!==undefined){
    const snap=recipe.sourceSnapshot;
    if(!obj(snap)||Object.keys(snap).sort().join('|')!=='commit|repository|sha256'||
       typeof snap.commit!=='string'||!commit.test(snap.commit)||
       typeof snap.sha256!=='string'||!hex64.test(snap.sha256))
      refuse('SOURCE_PIN','invalid source snapshot identity');
    boundedString(snap.repository,'source snapshot repository',300);
    sourceSnapshot=Object.freeze({...snap});
    if(!Array.isArray(recipe.packagePins)||recipe.packagePins.length===0||recipe.packagePins.length>16)
      refuse('SOURCE_PIN','bounded package pin set required');
    const seen=new Set();
    packagePins=Object.freeze(recipe.packagePins.map(p=>{
      if(!obj(p)||Object.keys(p).sort().join('|')!=='methodId|packageId|sha256'||
        typeof p.sha256!=='string'||!hex64.test(p.sha256))
        refuse('SOURCE_PIN','invalid selected package pin');
      boundedString(p.methodId,'source method id',160);
      boundedString(p.packageId,'source package id',160);
      if(seen.has(p.methodId))refuse('SOURCE_PIN','duplicate method pin');
      seen.add(p.methodId);
      return Object.freeze({...p});
    }).sort((a,b)=>a.methodId<b.methodId?-1:a.methodId>b.methodId?1:0));
  }
  return Object.freeze({...recipe,requiredOutcomes:Object.freeze([...out].sort()),
    ...(sourceSnapshot?{sourceSnapshot,packagePins}:{})});
}
function validateMethod(method){
  if(!obj(method))refuse('INVALID_METHOD','method must be an object');
  for(const f of ['id','origin','sourcePath','methodVersion'])boundedString(method[f],f,180);
  if(!safePath.test(method.sourcePath)||method.sourcePath.startsWith('/')||method.sourcePath.split('/').includes('..'))
    refuse('SOURCE_PATH','source path must be repository relative');
  if(typeof method.commit!=='string'||!commit.test(method.commit)||typeof method.sha256!=='string'||!hex64.test(method.sha256))
    refuse('SOURCE_PIN','source commit and digest are required');
  if(typeof method.methodText!=='string'||method.methodText.length===0||method.methodText.length>20_000||
      method.methodText!==method.methodText.normalize('NFC')||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(method.methodText))
    refuse('INVALID_METHOD','method text is not a bounded safe UTF-8 string');
  if(SHA(utf8(method.methodText))!==method.sha256)refuse('SOURCE_MISMATCH','method byte digest mismatch');
  if(!Array.isArray(method.covers)||method.covers.length===0||method.covers.length>32||
     method.covers.some(o=>typeof o!=='string'||!o||o.length>160||o!==o.normalize('NFC')||/[\u0000-\u001f\u007f]/u.test(o))||
     new Set(method.covers).size!==method.covers.length)
    refuse('INVALID_METHOD','invalid covered outcomes');
  if(method.containsAssets!==false)refuse('RIGHTS_UNRESOLVED','nested assets require a separate rights gate');
  if(method.methodVersion===PROCEDURE_VERSION)parseTextProcedure(method.methodText);
  const allowed=new Set(['id','origin','sourcePath','commit','sha256','methodVersion','methodText','covers','containsAssets']);
  if(Object.keys(method).some(k=>!allowed.has(k)))refuse('INVALID_METHOD','unrecognized method field');
  return Object.freeze({...method,covers:Object.freeze([...method.covers].sort())});
}
function escapedMarkdown(x){
  // Quoted method text is data, never execution authority.
  return x.replace(/\\/gu,'\\\\').replace(/([*_~\[\]<>!#|])/gu,'\\$1')
    .replaceAll(String.fromCharCode(96),'\\'+String.fromCharCode(96));
}
function mdLine(x){return escapedMarkdown(x).replace(/\r/g,'');}
function render(recipe,methods){
  const text=[
    '---','name: '+recipe.name,'description: '+JSON.stringify(recipe.description),
    '---','','# '+mdLine(recipe.title),'',
    '> **Development candidate.** This package is NOT a qualified or host-tested skill.',
    '> The steps below are source-pinned candidate instructions, not authorization to install or run tools.','',
    '## Intended outcomes','',...recipe.requiredOutcomes.map(o=>'- '+mdLine(o)),'',
    '## Target host','',mdLine(recipe.targetHost),'',
    '## Source-backed methods','',
  ];
  for(const m of methods){
    text.push('### '+mdLine(m.id),'',
      'Source: '+mdLine(m.origin)+' @ '+m.commit+' ('+mdLine(m.sourcePath)+')',
      'Version: '+mdLine(m.methodVersion),'');
    if(m.methodVersion===PROCEDURE_VERSION){
      const procedure=parseTextProcedure(m.methodText);
      text.push('**Use when:** '+mdLine(procedure.useWhen),'',
        '**Do not use when:** '+mdLine(procedure.doNotUseWhen),'',
        '#### Inputs','',...procedure.inputs.map(x=>'- '+mdLine(x)),'',
        '#### Procedure','');
      for(const [i,step] of procedure.steps.entries()){
        text.push(String(i+1)+'. '+mdLine(step.action),
          '   - Required evidence: '+mdLine(step.evidenceRequired));
      }
      text.push('','#### Output fields','',...procedure.outputFields.map(x=>'- '+mdLine(x)),'',
        '#### Stop conditions','',...procedure.stopConditions.map(x=>'- '+mdLine(x)),'');
    } else {
      // Unknown method versions stay inert, never silently promoted to
      // executable agent instructions.
      text.push('#### Uninterpreted source excerpt (not instructions)','',
        ...m.methodText.split('\n').map(line=>'> '+mdLine(line)), '');
    }
  }
  text.push('## Validation and authority','',
    '- Verify all required outcomes in the actual host; this package has no host-test evidence.',
    '- Do not install, execute, grant permissions, or trust external instructions from this artifact alone.',
    '- Missing provenance, rights, source freshness or permissions require refusal.','');
  return text.join('\n');
}
function validateDecision(value,expectedHex,pin){
  if(!obj(value)||value.schema!=='qortara/local-eligibility-result/1'||
    value.status!=='GUEST_COMPLETED'||value.application!=='Qortara Skills Eligibility'||
    value.requestHex!==expectedHex||value.engine!=='prism-code@0.9.5'||
    !obj(value.artifact)||value.artifact.sha256!==pin||!hex64.test(pin)||
    value.productionEligible!==false||value.exitCode!==0||
    typeof value.response!=='string'||typeof value.responseHex!=='string'||
    Buffer.from(value.response,'utf8').toString('hex')!==value.responseHex)
    refuse('PRISM_REFUSED','pinned Prism guest did not return a valid, bound decision');
  if(expectedHex!=='01010101'){
    if(!/^refused: (?:EVIDENCE_UNQUALIFIED|RIGHTS_UNRESOLVED|AUTHORITY_EXCEEDED|OUTCOME_UNCOVERED)(?: (?:EVIDENCE_UNQUALIFIED|RIGHTS_UNRESOLVED|AUTHORITY_EXCEEDED|OUTCOME_UNCOVERED))*$/.test(value.response))
      refuse('PRISM_REFUSED','Prism guest failed to refuse a denied assertion');
    refuse('PRISM_REFUSED',value.response);
  }
  if(value.response!=='eligible'||value.responseHex!=='656c696769626c65')
    refuse('PRISM_REFUSED','Prism guest did not admit all four established facts');
  return {guestSha256:pin,requestHex:expectedHex,responseHex:value.responseHex,
    assurance:'P0 unverified',engine:'prism-code@0.9.5'};
}
/**
 * Only trusted integration code may inject these two adapters.
 * assertMethod must independently establish evidence, reuse rights, caller
 * authority and outcome coverage, returning proofDigest and issuer.
 * The real Prism guest remains the FINAL eligibility decision.
 */
export function createComposer({assertMethod,runPrism,holoSha256,sourceApprovalBindings}={}){
  if(typeof assertMethod!=='function'||typeof runPrism!=='function'||
     typeof holoSha256!=='string'||!hex64.test(holoSha256))
    refuse('ADAPTER_MISSING','trusted assertion and Prism guest adapters plus pinned holo digest required');
  // Only trusted coordinator bootstrap supplies these expected exact source
  // bindings. A source method or user recipe cannot turn this check on/off.
  const requireSourceApproval=sourceApprovalBindings!==undefined;
  let acceptedBindings;
  if(requireSourceApproval){
    if(!obj(sourceApprovalBindings)||Object.keys(sourceApprovalBindings).length<1||
       Object.keys(sourceApprovalBindings).length>16||
       Object.entries(sourceApprovalBindings).some(([id,d])=>
         typeof id!=='string'||id.length<1||id.length>180||
         id!==id.normalize('NFC')||/[\\u0000-\\u001f\\u007f]/u.test(id)||
         ['__proto__','constructor','prototype'].includes(id)||!hex64.test(d)))
      refuse('SOURCE_ACCEPTANCE_CONFIG',
        'operator must pin a bounded exact binding SHA-256 for each method');
    acceptedBindings=Object.freeze({...sourceApprovalBindings});
  }
  return async function compose(recipeRaw,methodInputs){
    const recipe=validateRecipe(recipeRaw);
    if(!Array.isArray(methodInputs)||methodInputs.length===0||methodInputs.length>16)
      refuse('METHOD_SET','method set must be bounded and nonempty');
    const methods=methodInputs.map(validateMethod).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    if(new Set(methods.map(m=>m.id)).size!==methods.length)refuse('METHOD_SET','duplicate method identity');
    if(recipe.packagePins && (recipe.packagePins.length!==methods.length||
       recipe.packagePins.some((p,i)=>p.methodId!==methods[i].id)))
      refuse('SOURCE_PIN','source package identities must bind every selected method');
    if(requireSourceApproval &&
       (!recipe.sourceSnapshot||!recipe.packagePins||
        Object.keys(acceptedBindings).length!==methods.length||
        methods.some(m=>!Object.hasOwn(acceptedBindings,m.id))))
      refuse('SOURCE_ACCEPTANCE_CONFIG',
        'source approval requires an exact pinned snapshot, packages and one binding per method');
    // Independent refusal for uncovered outcomes. This does not admit any source.
    const covered=new Set(methods.flatMap(m=>m.covers));
    if(recipe.requiredOutcomes.some(o=>!covered.has(o)))refuse('OUTCOME_UNCOVERED','essential outcome missing from declared method coverage');
    const assertions=[];
    for(const method of methods){
      const subjectSha256=digestJSON({schema:'qortara/assurance-subject/1',
        planSha256:digestJSON(recipe),method:{id:method.id,origin:method.origin,
          sourcePath:method.sourcePath,commit:method.commit,sha256:method.sha256,
          methodVersion:method.methodVersion,covers:method.covers,containsAssets:false}});
      const x=await assertMethod({recipe,method,subjectSha256});
      if(!obj(x)||[x.evidence,x.rights,x.authority,x.coverage].some(y=>typeof y!=='boolean')||
          typeof x.issuer!=='string'||!x.issuer||typeof x.proofDigest!=='string'||!hex64.test(x.proofDigest)||
          x.subjectSha256!==subjectSha256)
        refuse('UNTRUSTED_ASSERTION','source, rights, authority or coverage not independently asserted');
      if(requireSourceApproval){
        if(x.sourceBindingSha256!==acceptedBindings[method.id]||
           !hex64.test(x.sourceBindingSha256)||
           !hex64.test(x.sourceAcceptanceProofSha256))
          refuse('SOURCE_ACCEPTANCE_REQUIRED',
            'independent source approval proof and configured exact method binding are missing or wrong');
      }else if(x.sourceBindingSha256!==undefined||
               x.sourceAcceptanceProofSha256!==undefined){
        refuse('SOURCE_ACCEPTANCE_CONFIG',
          'signed source-approval proof requires explicit trusted coordinator binding');
      }
      const hex=[x.evidence,x.rights,x.authority,x.coverage].map(y=>y?'01':'00').join('');
      // The four facts are derived ONLY from the trusted assertion adapter.
      // Prism determines admission or refusal over those facts, not this module.
      const verdict=validateDecision(await runPrism({requestHex:hex,holoSha256}),hex,holoSha256);
      assertions.push({methodId:method.id,issuer:x.issuer,subjectSha256,
        proofDigest:x.proofDigest,verdict,
        ...(requireSourceApproval?{
          sourceBindingSha256:x.sourceBindingSha256,
          sourceAcceptanceProofSha256:x.sourceAcceptanceProofSha256}:{})});
    }
    const markdown=render(recipe,methods),methodRefs=methods.map(({id,origin,sourcePath,commit,sha256,methodVersion,covers})=>
      ({id,origin,sourcePath,commit,sha256,methodVersion,covers}));
    const sourceRecord={schema:'qortara/skill-sources/1',methods:methodRefs,
      ...(recipe.sourceSnapshot?{sourceSnapshot:recipe.sourceSnapshot,
        packagePins:recipe.packagePins}:{})};
    const sourceJson=canonicalJSON(sourceRecord);
    const files={'SKILL.md':markdown,'SOURCES.json':sourceJson};
    const digests=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,data])=>[name,SHA(utf8(data))]));
    const receipt={schema:'qortara/skill-receipt/1',recipeSha256:digestJSON(recipe),sourceSha256:SHA(utf8(sourceJson)),
      files:digests,assertions,
      ...(requireSourceApproval?{sourceApprovalRequired:true,
        sourceApprovalState:'PROOF_DIGESTS_RECORDED_SIGNATURES_REQUIRE_INDEPENDENT_REPLAY'}:{}),
      assurance:'P0 unverified',productionEligible:false,
      hostValidated:false,modelCallsMeasured:false,claim:'DEVELOPMENT_CANDIDATE'};
    files['RECEIPT.json']=canonicalJSON(receipt);
    const manifest={schema:PACKAGE_SCHEMA,name:recipe.name,targetHost:recipe.targetHost,
      receiptSha256:SHA(utf8(files['RECEIPT.json'])),productionEligible:false};
    files['skill-mason.json']=canonicalJSON(manifest);
    return {schema:PACKAGE_SCHEMA,status:'DEVELOPMENT_CANDIDATE',files};
  };
}
/** Recompute file-to-receipt digests, NOT issuer authentication. */
export function verifyPackage(packageValue){
  if(!obj(packageValue)||packageValue.schema!==PACKAGE_SCHEMA||
     packageValue.status!=='DEVELOPMENT_CANDIDATE'||!obj(packageValue.files)||
     Object.keys(packageValue.files).sort().join('|')!==['RECEIPT.json','SKILL.md','SOURCES.json','skill-mason.json'].join('|'))
    refuse('PACKAGE_SCHEMA','unexpected package structure');
  const files=packageValue.files;
  for(const [name,data] of Object.entries(files))if(typeof data!=='string'||Buffer.byteLength(data,'utf8')>500_000)
    refuse('PACKAGE_SCHEMA','invalid package file: '+name);
  let manifest,receipt;
  try{manifest=JSON.parse(files['skill-mason.json']);receipt=JSON.parse(files['RECEIPT.json']);}
  catch{refuse('PACKAGE_SCHEMA','invalid JSON payload');}
  if(manifest.schema!==PACKAGE_SCHEMA||manifest.productionEligible!==false||
    manifest.receiptSha256!==SHA(utf8(files['RECEIPT.json']))||
    receipt.schema!=='qortara/skill-receipt/1'||receipt.productionEligible!==false||
    receipt.claim!=='DEVELOPMENT_CANDIDATE'||
    !obj(receipt.files)||receipt.files['SKILL.md']!==SHA(utf8(files['SKILL.md']))||
    receipt.files['SOURCES.json']!==SHA(utf8(files['SOURCES.json']))||
    receipt.sourceSha256!==SHA(utf8(files['SOURCES.json'])))
    refuse('PACKAGE_INTEGRITY','receipt or file digest mismatch');
  // Integrity checks below detect partial/malformed source proof persistence.
  // A digest by itself is not a verified Ed25519 signature or rights grant:
  // the independently pinned coordinator must replay BOTH proof envelopes.
  let sources;
  try{sources=JSON.parse(files['SOURCES.json']);}
  catch{refuse('PACKAGE_INTEGRITY','invalid source JSON');}
  const refs=sources?.methods;
  if(!Array.isArray(refs)||!Array.isArray(receipt.assertions)||
     receipt.assertions.length!==refs.length||
     receipt.assertions.length<1||receipt.assertions.length>16)
    refuse('PACKAGE_INTEGRITY','source and assertion populations disagree');
  const strict=receipt.sourceApprovalRequired===true;
  if((receipt.sourceApprovalRequired!==undefined&&!strict)||
     (strict&&receipt.sourceApprovalState!==
       'PROOF_DIGESTS_RECORDED_SIGNATURES_REQUIRE_INDEPENDENT_REPLAY')||
     (!strict&&receipt.sourceApprovalState!==undefined))
    refuse('PACKAGE_INTEGRITY','invalid source proof mode');
  for(let i=0;i<refs.length;i++){
    const a=receipt.assertions[i];
    if(!obj(a)||a.methodId!==refs[i].id||
       !hex64.test(a.subjectSha256)||!hex64.test(a.proofDigest)||
       (strict?(!hex64.test(a.sourceBindingSha256)||
                !hex64.test(a.sourceAcceptanceProofSha256)):
        a.sourceBindingSha256!==undefined||
        a.sourceAcceptanceProofSha256!==undefined))
      refuse('PACKAGE_INTEGRITY','unbound or partial signed proof references');
  }
  return {state:'INTEGRITY_VERIFIED',productionQualified:false,authorityVerified:false,
    sourceAcceptanceProofRecorded:strict,
    sourceAcceptanceSignatureVerified:false,
    signedFourFactAssertionReverified:false,
    packageSha256:SHA(utf8(files['skill-mason.json']))};
}
const PACKAGE_FILES=Object.freeze(['SKILL.md','SOURCES.json','RECEIPT.json','skill-mason.json']);
const DISK_SEAL='.qortara-complete';

/** Refuse symlinked directory parents: no output redirection through link hops. */
async function checkedDestination(destination){
  if(typeof destination!=='string'||!destination.trim()||destination.includes('\0'))
    refuse('DESTINATION','explicit destination path required');
  const abs=resolve(destination),root=parse(abs).root;
  if(abs===root||basename(abs)==='.'||basename(abs)==='..')
    refuse('DESTINATION','refusing root or ambiguous destination');
  let current=root;
  for(const part of relative(root,dirname(abs)).split(sep).filter(Boolean)){
    current=join(current,part);
    let st;
    try{st=await lstat(current);}catch{refuse('DESTINATION','output parent missing or inaccessible');}
    if(!st.isDirectory()||st.isSymbolicLink())
      refuse('DESTINATION','output parent is not a real directory');
  }
  return abs;
}
function sealFor(packageValue){
  return canonicalJSON({schema:'qortara/skill-package-disk-seal/1',
    status:'DEVELOPMENT_CANDIDATE',manifestSha256:SHA(utf8(packageValue.files['skill-mason.json'])),
    fileCount:PACKAGE_FILES.length});
}
/**
 * Explicit NEW directory only. Files are fully written and fsynced before the
 * completion seal is created last; consumers must use readPackage() rather
 * than treating a visible directory as a completed candidate. No installation.
 */
export async function writePackage(packageValue,destination){
  verifyPackage(packageValue);
  const abs=await checkedDestination(destination);
  let created=false;
  try{
    await mkdir(abs,{mode:0o700}); // exclusive: refuses any existing directory/symlink
    created=true;
    for(const name of PACKAGE_FILES){
      const h=await open(resolve(abs,name),'wx',0o600);
      try{await h.writeFile(packageValue.files[name],'utf8');await h.sync();}
      finally{await h.close();}
    }
    const h=await open(resolve(abs,DISK_SEAL),'wx',0o600);
    try{await h.writeFile(sealFor(packageValue),'utf8');await h.sync();}
    finally{await h.close();}
    return {state:'WRITTEN_DEVELOPMENT_CANDIDATE',destination:abs,
      files:[...PACKAGE_FILES,DISK_SEAL]};
  }catch(err){
    // Only clean up a directory this call created. A crash may still leave an
    // unsealed directory; readPackage() treats that state as incomplete.
    if(created)await rm(abs,{recursive:true,force:true}).catch(()=>{});
    throw err;
  }
}
/** Read/verify only sealed packages, refusing symlinks, extra and missing files. */
export async function readPackage(destination){
  const abs=await checkedDestination(destination);
  let st;
  try{st=await lstat(abs);}catch{refuse('PACKAGE_INCOMPLETE','candidate directory missing');}
  if(!st.isDirectory()||st.isSymbolicLink())
    refuse('PACKAGE_INCOMPLETE','candidate directory is not a real directory');
  const expected=[...PACKAGE_FILES,DISK_SEAL].sort();
  let names;
  try{names=(await readdir(abs)).sort();}
  catch{refuse('PACKAGE_INCOMPLETE','unable to enumerate candidate files');}
  if(names.join('|')!==expected.join('|'))
    refuse('PACKAGE_INCOMPLETE','missing or unexpected candidate files or completion seal');
  const read=async name=>{
    const path=resolve(abs,name);
    let h;
    try{
      const fst=await lstat(path);
      if(!fst.isFile()||fst.isSymbolicLink()||fst.size>500_000)
        refuse('PACKAGE_INCOMPLETE','invalid candidate file: '+name);
      h=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      const st=await h.stat();
      if(!st.isFile()||st.size>500_000)
        refuse('PACKAGE_INCOMPLETE','invalid opened candidate file: '+name);
      return await h.readFile('utf8');
    }catch(err){
      if(err instanceof CompositionRefusal)throw err;
      refuse('PACKAGE_INCOMPLETE','cannot read candidate file: '+name);
    }finally{if(h)await h.close();}
  };
  const files={};
  for(const name of PACKAGE_FILES)files[name]=await read(name);
  const packageValue={schema:PACKAGE_SCHEMA,status:'DEVELOPMENT_CANDIDATE',files};
  const verification=verifyPackage(packageValue);
  let seal;
  try{seal=JSON.parse(await read(DISK_SEAL));}catch{
    refuse('PACKAGE_INCOMPLETE','invalid or unreadable completion seal');
  }
  if(!obj(seal)||Object.keys(seal).sort().join('|')!=='fileCount|manifestSha256|schema|status'||
     seal.schema!=='qortara/skill-package-disk-seal/1'||
     seal.status!=='DEVELOPMENT_CANDIDATE'||seal.fileCount!==PACKAGE_FILES.length||
     seal.manifestSha256!==verification.packageSha256)
    refuse('PACKAGE_INTEGRITY','disk completion seal does not match candidate');
  return packageValue;
}
