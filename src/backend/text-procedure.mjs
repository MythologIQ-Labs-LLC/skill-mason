/**
 * Bounded, declarative, text-only first-party pilot procedure.
 *
 * This module does not assert rights or decide Prism eligibility. It only
 * validates the shape of a procedure whose source bytes were already pinned.
 * It deliberately has no command, network, secret or tool invocation fields.
 */
export const PROCEDURE_SCHEMA='qortara/text-review-procedure/1';
export const PROCEDURE_VERSION='text-review-procedure-v1';

export class ProcedureRefusal extends Error{
  constructor(code,message){super(message);this.name='ProcedureRefusal';this.code=code;}
}
function refuse(message){throw new ProcedureRefusal('PROCEDURE_INVALID',message);}
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function fields(x,expected){
  if(!object(x)||Object.keys(x).sort().join('|')!==[...expected].sort().join('|'))
    refuse('unknown or missing structured procedure fields');
}
function bounded(x,what,{min=3,max=320}={}){
  if(typeof x!=='string'||x.length<min||x.length>max||
     x!==x.normalize('NFC')||/[\u0000-\u001f\u007f]/u.test(x))
    refuse('invalid '+what+' text');
  // Structured values are plain lines. No native Markdown frontmatter,
  // links or markup can escape out of the template's rendering context.
  return x;
}
function strings(arr,name,min,max){
  if(!Array.isArray(arr)||arr.length<min||arr.length>max)
    refuse('invalid '+name+' count');
  const normalized=arr.map(v=>bounded(v,name));
  if(new Set(normalized).size!==normalized.length)
    refuse('duplicate '+name);
  return Object.freeze([...normalized]);
}
export function parseTextProcedure(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>16_000)
    refuse('procedure must be bounded UTF-8 JSON');
  let value;
  try{value=JSON.parse(raw);}catch{refuse('procedure is not JSON');}
  fields(value,['schema','useWhen','doNotUseWhen','inputs','steps','outputFields','stopConditions']);
  if(value.schema!==PROCEDURE_SCHEMA)refuse('unsupported procedure schema');
  const useWhen=bounded(value.useWhen,'useWhen');
  const doNotUseWhen=bounded(value.doNotUseWhen,'doNotUseWhen');
  const inputs=strings(value.inputs,'inputs',1,8);
  const outputFields=strings(value.outputFields,'outputFields',2,10);
  const stopConditions=strings(value.stopConditions,'stopConditions',1,8);
  if(!Array.isArray(value.steps)||value.steps.length<2||value.steps.length>12)
    refuse('invalid step count');
  const steps=Object.freeze(value.steps.map((step)=>{
    fields(step,['action','evidenceRequired']);
    return Object.freeze({
      action:bounded(step.action,'action'),
      evidenceRequired:bounded(step.evidenceRequired,'evidenceRequired')
    });
  }));
  if(new Set(steps.map(s=>s.action)).size!==steps.length)
    refuse('duplicate procedure step');
  return Object.freeze({schema:PROCEDURE_SCHEMA,useWhen,doNotUseWhen,
    inputs,steps,outputFields,stopConditions});
}
