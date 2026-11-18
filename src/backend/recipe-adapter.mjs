/**
 * Strict public recipe.v0 -> internal candidate composition plan.
 *
 * Source records and host capabilities are operator-supplied, never derived
 * from the user's recipe or the read-only discovery export. Pin matching and
 * coverage declarations are NOT legal rights or behavioral qualifications.
 */
import {createHash} from 'node:crypto';

const SHA=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const SLUG=/^(?!.*--)[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const MAX_BYTES=1_000_000;

export class RecipeRefusal extends Error {
  constructor(code,message){super(message);this.name='RecipeRefusal';this.code=code;}
}
function refuse(code,message){throw new RecipeRefusal(code,message);}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function exact(v,names,code){
  if(!plain(v)||Object.keys(v).sort().join('|')!==[...names].sort().join('|'))
    refuse(code,'unexpected or missing input fields');
}
function text(v,max=180){
  return typeof v==='string'&&v.length>0&&v.length<=max&&v===v.normalize('NFC')&&!/[\u0000-\u001f\u007f]/u.test(v);
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function snapshot(value){
  exact(value,['repository','commit','sha256'],'SOURCE_SNAPSHOT');
  if(!text(value.repository,300)||!COMMIT.test(value.commit)||!SHA.test(value.sha256))
    refuse('SOURCE_SNAPSHOT','invalid repository or source snapshot pin');
  return Object.freeze({...value});
}
function normalizedArray(items,field,max=32){
  if(!Array.isArray(items)||items.length===0||items.length>max||
     items.some(x=>!text(x,160))||new Set(items).size!==items.length)
    refuse('INVALID_RECIPE','invalid, duplicate or unbounded '+field);
  return Object.freeze([...items].sort());
}
function record(entry){
  exact(entry,['method_id','package_id','package_sha256','packageBytes','method'],'SOURCE_RECORD');
  if(!text(entry.method_id)||!text(entry.package_id)||!SHA.test(entry.package_sha256))
    refuse('SOURCE_RECORD','invalid source method or package identity');
  if(!Buffer.isBuffer(entry.packageBytes)&&!(entry.packageBytes instanceof Uint8Array))
    refuse('SOURCE_BYTES_MISSING','source package must be supplied as checked bytes');
  const bytes=Buffer.from(entry.packageBytes);
  if(bytes.length===0||bytes.length>MAX_BYTES||sha(bytes)!==entry.package_sha256)
    refuse('SOURCE_MISMATCH','source package bytes differ from the pinned SHA-256');
  const m=entry.method;
  exact(m,['id','origin','sourcePath','commit','sha256','methodVersion','methodText','covers','containsAssets'],'SOURCE_RECORD');
  if(m.id!==entry.method_id||!text(m.origin,180)||!text(m.sourcePath,160)||
     !text(m.methodVersion,180)||!COMMIT.test(m.commit)||!SHA.test(m.sha256)||
     typeof m.methodText!=='string'||m.methodText.length===0||m.methodText.length>20_000||
     m.methodText!==m.methodText.normalize('NFC')||
     sha(Buffer.from(m.methodText,'utf8'))!==m.sha256)
    refuse('SOURCE_MISMATCH','method identity or source text SHA-256 differs');
  if(m.containsAssets!==false)refuse('RIGHTS_UNRESOLVED','nested package assets require separate authorization');
  // For the first pilot, method text must be a verbatim UTF-8 excerpt of the
  // independently hash-pinned full package bytes. No unreviewed transforms.
  if(!bytes.includes(Buffer.from(m.methodText,'utf8')))
    refuse('SOURCE_TEXT_UNBOUND','claimed method is not present in pinned package bytes');
  const covers=normalizedArray(m.covers,'method coverage');
  // Preserve the complete source identity. The composer separately validates
  // paths, authority and the exact source-method hash before any Prism call.
  return Object.freeze({
    method_id:entry.method_id,package_id:entry.package_id,
    package_sha256:entry.package_sha256,
    method:Object.freeze({...m,covers})
  });
}
/**
 * Construct using operator-authenticated catalog data, not an HTTP request.
 * No dynamic lookup, discovery, semantic matching or license inference.
 */
export function createRecipeAdapter({sourceSnapshot,supportedHosts,components}={}){
  const pin=snapshot(sourceSnapshot);
  const hosts=normalizedArray(supportedHosts,'supported hosts',64);
  if(!Array.isArray(components)||components.length===0||components.length>4096)
    refuse('SOURCE_RECORD','bounded method registry required');
  const known=new Map();
  for(const item of components){
    const x=record(item);
    const key=x.method_id+'\0'+x.package_id;
    if(known.has(key))refuse('SOURCE_RECORD','duplicate operator method/package');
    known.set(key,x);
  }
  return function adapt(publicRecipe){
    exact(publicRecipe,['schema_version','skill_id','title','description','target_host',
      'required_outcomes','source_snapshot','components','authority'],'INVALID_RECIPE');
    if(publicRecipe.schema_version!=='skill-mason.recipe.v0'||!SLUG.test(publicRecipe.skill_id)||
       !text(publicRecipe.title,120)||publicRecipe.title.length<3||
       !text(publicRecipe.description,400)||publicRecipe.description.length<3||
       !text(publicRecipe.target_host,150))
      refuse('INVALID_RECIPE','invalid recipe version or bounded text fields');
    const requested=normalizedArray(publicRecipe.required_outcomes,'required outcomes');
    const source=snapshot(publicRecipe.source_snapshot);
    if(source.repository!==pin.repository||source.commit!==pin.commit||source.sha256!==pin.sha256)
      refuse('UNTRUSTED_CATALOG','recipe snapshot not pinned to operator source');
    if(!hosts.includes(publicRecipe.target_host))
      refuse('HOST_UNSUPPORTED','no operator-backed contract for requested host');
    exact(publicRecipe.authority,['network','secrets','execution'],'AUTHORITY_EXCEEDED');
    if(publicRecipe.authority.network!==false||publicRecipe.authority.secrets!==false||
       publicRecipe.authority.execution!==false)
      refuse('AUTHORITY_EXCEEDED','unapproved authority requested');
    if(!Array.isArray(publicRecipe.components)||publicRecipe.components.length===0||
       publicRecipe.components.length>16)
      refuse('INVALID_RECIPE','bounded nonempty component selection required');
    const selected=[],pins=[],seen=new Set();
    for(const component of publicRecipe.components){
      if(!plain(component)||Object.keys(component).some(k=>!['method_id','package_id','package_sha256','parameters'].includes(k))||
         !['method_id','package_id','package_sha256'].every(k=>Object.hasOwn(component,k))||
         !text(component.method_id)||!text(component.package_id)||!SHA.test(component.package_sha256))
        refuse('INVALID_RECIPE','invalid selected component');
      if(component.parameters!==undefined){
        if(!plain(component.parameters))refuse('INVALID_RECIPE','parameters must be an object');
        if(Object.keys(component.parameters).length>0)
          refuse('PARAMETERS_UNSUPPORTED','parameter substitution requires independently reviewed template rules');
      }
      const key=component.method_id+'\0'+component.package_id;
      if(seen.has(key))refuse('INVALID_RECIPE','duplicate component selection');
      seen.add(key);
      const matched=known.get(key);
      if(!matched)refuse('UNKNOWN_ID','method and package not in operator source');
      if(matched.package_sha256!==component.package_sha256)
        refuse('SOURCE_MISMATCH','requested package does not match operator pin');
      selected.push(matched.method);
      pins.push(Object.freeze({methodId:matched.method_id,packageId:matched.package_id,sha256:matched.package_sha256}));
    }
    const covered=new Set(selected.flatMap(m=>m.covers));
    if(requested.some(o=>!covered.has(o)))
      refuse('OUTCOME_UNCOVERED','requested outcome has no exactly declared component');
    const plan=Object.freeze({
      schema:'qortara/internal-composition-plan/1',
      name:publicRecipe.skill_id,title:publicRecipe.title,description:publicRecipe.description,
      targetHost:publicRecipe.target_host,requiredOutcomes:requested,
      network:false,secrets:false,execution:false,
      sourceSnapshot:pin,
      packagePins:Object.freeze(pins.sort((a,b)=>a.methodId<b.methodId?-1:a.methodId>b.methodId?1:
                   a.packageId<b.packageId?-1:a.packageId>b.packageId?1:0))
    });
    return Object.freeze({plan,methods:Object.freeze([...selected])});
  };
}
