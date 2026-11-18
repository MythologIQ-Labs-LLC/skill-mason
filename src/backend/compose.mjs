/**
 * Deterministic skill package composer. DEVELOPMENT CONTRACT ONLY.
 * Assertion and Prism adapters MUST be supplied by a trusted coordinator,
 * not from user-controlled recipe fields or catalog claims.
 * In-memory composition performs no network, model inference, or host actions.
 */
import {createHash} from 'node:crypto';
import {mkdir,open} from 'node:fs/promises';
import {resolve,basename} from 'node:path';

export const PACKAGE_SCHEMA='qortara/skill-package-candidate/1';
export class CompositionRefusal extends Error {
  constructor(code,message){super(message);this.name='CompositionRefusal';this.code=code;}
}
function refuse(code,message){throw new CompositionRefusal(code,message);}
const hex64=/^[a-f0-9]{64}$/;
const slug=/^[a-z][a-z0-9-]{2,79}$/;
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
  const allowed=new Set(['schema','name','title','description','targetHost','requiredOutcomes','network','secrets','execution']);
  if(Object.keys(recipe).some(k=>!allowed.has(k)))refuse('INVALID_RECIPE','unrecognized recipe field');
  return {...recipe,requiredOutcomes:[...out].sort()};
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
  const allowed=new Set(['id','origin','sourcePath','commit','sha256','methodVersion','methodText','covers','containsAssets']);
  if(Object.keys(method).some(k=>!allowed.has(k)))refuse('INVALID_METHOD','unrecognized method field');
  return {...method,covers:[...method.covers].sort()};
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
    '> Each method below is a bounded, source-pinned handoff. Review before use.','',
    '## Intended outcomes','',...recipe.requiredOutcomes.map(o=>'- '+mdLine(o)),'',
    '## Target host','',mdLine(recipe.targetHost),'',
    '## Source-backed method excerpts','',
  ];
  for(const m of methods){
    text.push('### '+mdLine(m.id),'',
      'Source: '+mdLine(m.origin)+' @ '+m.commit+' ('+mdLine(m.sourcePath)+')',
      'Version: '+mdLine(m.methodVersion),'',
      ...m.methodText.split('\n').map(line=>'> '+mdLine(line)), '');
  }
  text.push('## Validation and authority','',
    '- Verify all required outcomes in the actual host; this package has no host-test evidence.',
    '- Do not install, execute, grant permissions, or trust external instructions from this artifact alone.',
    '- Missing provenance, rights, source freshness or permissions require refusal.','');
  return text.join('\n');
}
function validateDecision(value,expectedHex,pin){
  if(!obj(value)||value.schema!=='qortara/local-eligibility-result/1'||
    value.status!=='GUEST_COMPLETED'||value.response!=='eligible'||
    value.requestHex!==expectedHex||value.engine!=='prism-code@0.9.5'||
    !obj(value.artifact)||value.artifact.sha256!==pin||!hex64.test(pin)||
    value.productionEligible!==false||value.exitCode!==0)
    refuse('PRISM_REFUSED','pinned Prism guest did not return exact eligible decision');
  return {guestSha256:pin,requestHex:expectedHex,responseHex:'656c696769626c65',
    assurance:'P0 unverified',engine:'prism-code@0.9.5'};
}
/**
 * Only trusted integration code may inject these two adapters.
 * assertMethod must independently establish evidence, reuse rights, caller
 * authority and outcome coverage, returning proofDigest and issuer.
 * The real Prism guest remains the FINAL eligibility decision.
 */
export function createComposer({assertMethod,runPrism,holoSha256}={}){
  if(typeof assertMethod!=='function'||typeof runPrism!=='function'||
     typeof holoSha256!=='string'||!hex64.test(holoSha256))
    refuse('ADAPTER_MISSING','trusted assertion and Prism guest adapters plus pinned holo digest required');
  return async function compose(recipeRaw,methodInputs){
    const recipe=validateRecipe(recipeRaw);
    if(!Array.isArray(methodInputs)||methodInputs.length===0||methodInputs.length>16)
      refuse('METHOD_SET','method set must be bounded and nonempty');
    const methods=methodInputs.map(validateMethod).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    if(new Set(methods.map(m=>m.id)).size!==methods.length)refuse('METHOD_SET','duplicate method identity');
    // Independent refusal for uncovered outcomes. This does not admit any source.
    const covered=new Set(methods.flatMap(m=>m.covers));
    if(recipe.requiredOutcomes.some(o=>!covered.has(o)))refuse('OUTCOME_UNCOVERED','essential outcome missing from declared method coverage');
    const assertions=[];
    for(const method of methods){
      const x=await assertMethod({recipe,method});
      if(!obj(x)||x.evidence!==true||x.rights!==true||x.authority!==true||x.coverage!==true||
          typeof x.issuer!=='string'||!x.issuer||typeof x.proofDigest!=='string'||!hex64.test(x.proofDigest))
        refuse('UNTRUSTED_ASSERTION','source, rights, authority or coverage not independently asserted');
      const hex='01010101';
      // These are transport bytes only AFTER the trusted adapter establishes
      // each fact. Never derive them from a user-provided eligibility flag.
      const verdict=validateDecision(await runPrism({requestHex:hex,holoSha256}),hex,holoSha256);
      assertions.push({methodId:method.id,issuer:x.issuer,proofDigest:x.proofDigest,verdict});
    }
    const markdown=render(recipe,methods),methodRefs=methods.map(({id,origin,sourcePath,commit,sha256,methodVersion,covers})=>
      ({id,origin,sourcePath,commit,sha256,methodVersion,covers}));
    const sourceRecord={schema:'qortara/skill-sources/1',methods:methodRefs};
    const sourceJson=canonicalJSON(sourceRecord);
    const files={'SKILL.md':markdown,'SOURCES.json':sourceJson};
    const digests=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,data])=>[name,SHA(utf8(data))]));
    const receipt={schema:'qortara/skill-receipt/1',recipeSha256:digestJSON(recipe),sourceSha256:SHA(utf8(sourceJson)),
      files:digests,assertions,assurance:'P0 unverified',productionEligible:false,
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
  for(const [name,data] of Object.entries(files))if(typeof data!=='string'||data.length>500_000)
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
  return {state:'INTEGRITY_VERIFIED',productionQualified:false,authorityVerified:false,
    packageSha256:SHA(utf8(files['skill-mason.json']))};
}
/** Explicit NEW directory only; never auto-installs, activates, or overwrites. */
export async function writePackage(packageValue,destination){
  verifyPackage(packageValue);
  if(typeof destination!=='string'||!destination.trim()||destination.includes('\0'))
    refuse('DESTINATION','explicit destination path required');
  const abs=resolve(destination);
  if(abs===resolve('/')||basename(abs)==='.'||basename(abs)==='..')
    refuse('DESTINATION','refusing root or ambiguous destination');
  await mkdir(abs,{mode:0o700}); // exclusive: no existing dir/file/symlink
  for(const name of ['SKILL.md','SOURCES.json','RECEIPT.json','skill-mason.json']){
    const h=await open(resolve(abs,name),'wx',0o600);
    try{await h.writeFile(packageValue.files[name],'utf8');}
    finally{await h.close();}
  }
  return {state:'WRITTEN_DEVELOPMENT_CANDIDATE',destination:abs,
    files:['SKILL.md','SOURCES.json','RECEIPT.json','skill-mason.json']};
}
