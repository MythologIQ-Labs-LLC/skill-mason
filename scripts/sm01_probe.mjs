#!/usr/bin/env node
/**
 * Execute SM-01 acceptance requests against an actual Prism holo.
 * Never implement eligibility here. Never claim P2 from a fixture run.
 * API pinned to prism-code@0.9.5, PrismPM d896ab59e287650aecbcf02b8e867121601fdde5.
 */
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CASES = Object.freeze([
  { id: 'eligible', hex: '01010101', expected: 'eligible' },
  { id: 'evidence', hex: '00010101', expected: 'refused: EVIDENCE_UNQUALIFIED' },
  { id: 'rights', hex: '01000101', expected: 'refused: RIGHTS_UNRESOLVED' },
  { id: 'prohibited-rights', hex: '01020101', expected: 'refused: RIGHTS_UNRESOLVED' },
  { id: 'authority', hex: '01010001', expected: 'refused: AUTHORITY_EXCEEDED' },
  { id: 'coverage', hex: '01010100', expected: 'refused: OUTCOME_UNCOVERED' },
  { id: 'all-refused', hex: '00000000', expected: 'refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED' },
  { id: 'unknown-code', hex: 'ff010101', expected: 'refused: EVIDENCE_UNQUALIFIED' },
  { id: 'short', hex: '010101', expected: 'invalid request' },
  { id: 'long', hex: '0101010101', expected: 'invalid request' },
  { id: 'empty', hex: '', expected: 'invalid request' },
  { id: 'allocation-boundary', hex: '00'.repeat(512), expected: 'invalid request' },
]);
const SHA = /^[0-9a-f]{64}$/;
export class ProbeError extends Error {
  constructor(code, message) { super(message); this.code=code; this.name='ProbeError'; }
}

export function options(args) {
  if (args.length===1 && args[0]==='--help') return {help:true};
  const out={caseId:'all',allowP0:false};
  const seen=new Set();
  for(let i=0;i<args.length;i++){
    const key=args[i];
    if(!['--holo','--sha256','--case','--report','--allow-p0'].includes(key) || seen.has(key))
      throw new ProbeError('USAGE','unknown or duplicate option: '+key);
    seen.add(key);
    if(key==='--allow-p0'){out.allowP0=true;continue;}
    const value=args[++i];
    if(!value || value.startsWith('--'))throw new ProbeError('USAGE','missing value: '+key);
    if(key==='--holo')out.holo=value;
    if(key==='--sha256')out.sha256=value;
    if(key==='--case')out.caseId=value;
    if(key==='--report')out.report=value;
  }
  if(!out.holo || !SHA.test(out.sha256??''))throw new ProbeError('USAGE','--holo and lowercase 64-character --sha256 are required');
  if(!out.allowP0)throw new ProbeError('ASSURANCE_HOLD','explicit --allow-p0 required for a development-only P0 fixture run');
  if(out.caseId!=='all' && !CASES.some(c=>c.id===out.caseId))throw new ProbeError('USAGE','unrecognized fixture: '+out.caseId);
  return out;
}
export async function artifact(path,expectedSha) {
  if(!SHA.test(expectedSha))throw new ProbeError('USAGE','invalid digest');
  if(!path.endsWith('.holo'))throw new ProbeError('USAGE','expected a .holo filename');
  let stat;
  try{stat=await lstat(path);}catch{throw new ProbeError('ARTIFACT_MISSING','holo does not exist');}
  if(!stat.isFile() || stat.isSymbolicLink())throw new ProbeError('ARTIFACT_INVALID','holo must be a regular non-symlink file');
  const bytes=await readFile(path);
  if(bytes.length===0)throw new ProbeError('ARTIFACT_INVALID','holo is empty');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==expectedSha)throw new ProbeError('DIGEST_MISMATCH','holo SHA-256 does not match the expected pin');
  return {path:resolve(path),sha256,byteLength:bytes.length};
}
export async function runCases(path,caseId,runtime,identity){
  const entries=caseId==='all'?CASES:CASES.filter(c=>c.id===caseId);
  const results=[];
  for(const c of entries){
    try {
      // Uint8Array carries NUL bytes; shell argv cannot. Never use a simulated eligibility algorithm.
      const result=await runtime.containers.run(path,Uint8Array.from(Buffer.from(c.hex,'hex')),{
        policy:{minimum:'P0',effects:[]},rm:true
        // NO allowUnverified: structural/policy refusal must still fail.
      });
      const actual=result.output instanceof Uint8Array ? Buffer.from(result.output).toString('utf8') : null;
      const pass=result.status==='exited' && result.exitCode===0 && actual===c.expected;
      results.push({case:c.id,requestHex:c.hex,expected:c.expected,actual,exitCode:result.exitCode,pass});
    }catch(err){
      results.push({case:c.id,requestHex:c.hex,expected:c.expected,actual:null,exitCode:null,pass:false,error:err?.code??'RUNTIME_ERROR'});
    }
  }
  return {schema:'qortara/sm01-output-probe/1',application:'Qortara Skills Eligibility',
    artifact:identity,engine:'prism-code@0.9.5',
    assurance:'P0 unverified - explicit fixture-only policy, not P2',
    productionEligible:false,tests:results,passed:results.filter(x=>x.pass).length,total:results.length,
    verdict:results.every(x=>x.pass)?'FIXTURE_PASS':'FIXTURE_FAIL'};
}
export async function main(args,loadRuntime=async()=>{
  const {createRequire}=await import('node:module');
  const req=createRequire(import.meta.url);
  let pkg;
  try{pkg=req('prism-code/package.json');}catch{throw new ProbeError('RUNTIME_MISSING','install pinned prism-code@0.9.5');}
  if(pkg.version!=='0.9.5')throw new ProbeError('RUNTIME_VERSION','expected prism-code@0.9.5, got '+pkg.version);
  const module=await import('prism-code');
  if(!module.prism?.containers?.run)throw new ProbeError('RUNTIME_API','pinned Prism containers API missing');
  return module.prism;
}){
  const opt=options(args);
  if(opt.help)return {help:true};
  const identity=await artifact(opt.holo,opt.sha256);
  const runtime=await loadRuntime();
  const report=await runCases(identity.path,opt.caseId,runtime,identity);
  if(opt.report)await writeFile(opt.report,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  return report;
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    const result=await main(process.argv.slice(2));
    if(result.help)console.log('Usage: node scripts/sm01_probe.mjs --holo <built.holo> --sha256 <expected_sha256> --allow-p0 [--case all|fixture-id] [--report NEW.json]\nP0 development fixtures only; all eligibility decisions must come from Prism.');
    else{console.log(JSON.stringify(result,null,2));if(result.verdict!=='FIXTURE_PASS')process.exitCode=1;}
  }catch(err){
    console.error(JSON.stringify({code:err?.code??'UNEXPECTED',message:err?.message??String(err)}));
    process.exitCode=2;
  }
}
