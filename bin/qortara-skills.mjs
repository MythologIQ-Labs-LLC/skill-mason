#!/usr/bin/env node
/**
 * Qortara Skills local Prism development CLI.
 * No skill generation, installation, inference, or alternate eligibility engine.
 */
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { artifact, main as probeMain, ProbeError } from '../scripts/sm01_probe.mjs';

export const VERSION='0.1.0-dev.0';
const MAX_BYTES=512;
const shaPattern=/^[0-9a-f]{64}$/;
const FLAG_VALUES=new Set(['--holo','--sha256','--hex','--case','--report',
  '--request','--route','--host','--handoff','--source-checkout','--method',
  '--external-checkout','--external-repository-tree']);
const FLAG_BOOLEAN=new Set(['--allow-p0','--json']);
const USAGE=[
 'Qortara Skills '+VERSION+' | local development-only Prism client',
 '',
 'Commands:',
 '  qortara-skills status [--holo FILE --sha256 SHA256] [--json]',
 '  qortara-skills evaluate --holo FILE --sha256 SHA256 --hex HEX --allow-p0 [--report NEW.json]',
 '  qortara-skills probe --holo FILE --sha256 SHA256 --allow-p0 [--case ID] [--report NEW.json]',
 '  qortara-skills create --request TEXT --route DOMAIN/SUBDOMAIN --host HOST --handoff DIR --source-checkout DIR [--method governed:ID] [--external-checkout DIR --external-repository-tree GIT_TREE] [--report NEW.json]',
 '  qortara-skills version',
 '  qortara-skills help',
 '',
 'Requires Node.js 22+ and exact prism-code@0.9.5 to run a real holo.',
 '--allow-p0 is fixture-only consent, not trusted production assurance.',
 'Create verifies the exact pinned corpus and issues an actionable refusal until genuine approval exists.',
 'Create requires Python 3.11+ and the separately pinned local skillz source checkout.',
 'No approved SKILL.md generation, skill installation, or source-rights self-authorization.'
].join('\n');

export function parseCommand(argv) {
  if (!argv.length || argv[0]==='help' || (argv.length===1 && argv[0]==='--help'))
    return {command:'help',flags:{}};
  if (argv[0]==='version' && argv.length===1) return {command:'version',flags:{}};
  const [command,...args]=argv;
  if (!['status','evaluate','probe','create'].includes(command))
    throw new ProbeError('USAGE','Unknown command: '+command);
  const flags={};
  for (let i=0;i<args.length;i++) {
    const name=args[i];
    if ((!FLAG_VALUES.has(name) && !FLAG_BOOLEAN.has(name)) || name in flags)
      throw new ProbeError('USAGE','Unknown or repeated option: '+name);
    if (FLAG_BOOLEAN.has(name)) flags[name]=true;
    else {
      const val=args[++i];
      if (val===undefined || val.startsWith('--'))
        throw new ProbeError('USAGE','Missing value for '+name);
      flags[name]=val;
    }
  }
  const allowed=command==='status'
    ? ['--holo','--sha256','--json']
    : command==='create'
      ? ['--request','--route','--host','--handoff','--source-checkout',
         '--method','--external-checkout','--external-repository-tree','--report']
    : command==='probe'
      ? ['--holo','--sha256','--case','--report','--allow-p0']
      : ['--holo','--sha256','--hex','--report','--allow-p0'];
  for (const key of Object.keys(flags)) {
    if (!allowed.includes(key)) throw new ProbeError('USAGE','Option '+key+' is not valid for '+command);
  }
  if (command==='status' && Boolean(flags['--holo'])!==Boolean(flags['--sha256']))
    throw new ProbeError('USAGE','status requires both --holo and --sha256 when either is specified');
  if (command==='create') {
    for (const name of ['--request','--host','--handoff','--source-checkout']) {
      if (!flags[name]) throw new ProbeError('USAGE','Missing '+name+' for request admission');
    }
    if (Boolean(flags['--external-checkout'])!==Boolean(flags['--external-repository-tree']))
      throw new ProbeError('USAGE','External source checkout and exact repository tree must be supplied together');
    if (flags['--external-checkout'] && !flags['--method'])
      throw new ProbeError('USAGE','An external checkout requires an exact governed method ID');
  }
  if (command!=='status' && command!=='create') {
    if (!flags['--holo'] || !shaPattern.test(flags['--sha256']??''))
      throw new ProbeError('USAGE','--holo and lowercase 64-character --sha256 required');
    if (!flags['--allow-p0'])
      throw new ProbeError('ASSURANCE_HOLD','Explicit --allow-p0 required for development-only P0 evaluation');
  }
  if (command==='evaluate') {
    const hex=flags['--hex'];
    if (hex===undefined || !/^(?:[0-9a-fA-F]{2})*$/.test(hex) || hex.length>MAX_BYTES*2)
      throw new ProbeError('USAGE','--hex must be even-length hexadecimal of at most 512 bytes');
  }
  return {command,flags};
}

export async function localStatus(flags,deps={}) {
  const nodeVersion=deps.nodeVersion??process.versions.node;
  const nodeSupported=Number(nodeVersion.split('.')[0])>=22;
  let runtime={status:'NOT_INSTALLED',required:'prism-code@0.9.5'};
  try {
    const pkg=deps.runtimePackage??createRequire(import.meta.url)('prism-code/package.json');
    runtime={status:pkg.version==='0.9.5'?'PINNED':'VERSION_MISMATCH',
      installed:pkg.version,required:'prism-code@0.9.5'};
  } catch(err) {
    if (err?.code!=='MODULE_NOT_FOUND') throw err;
  }
  let holo={status:'NOT_SUPPLIED'};
  if (flags['--holo']) {
    try {holo={status:'DIGEST_MATCH',...(await artifact(flags['--holo'],flags['--sha256']))};}
    catch(err) {holo={status:err?.code??'ERROR'};}
  }
  return {schema:'qortara/local-cli-status/1',cliVersion:VERSION,nodeVersion,
    nodeStatus:nodeSupported?'SUPPORTED':'UNSUPPORTED',runtime,holo,
    preflightReady:nodeSupported && runtime.status==='PINNED' && holo.status==='DIGEST_MATCH',
    applicationNativeCheck:'NOT_RUN',independentAssurance:'P0 unverified',
    productionReady:false};
}
export async function loadPinnedRuntime() {
  const req=createRequire(import.meta.url);
  let pkg;
  try {pkg=req('prism-code/package.json');}
  catch(err) {
    if (err?.code==='MODULE_NOT_FOUND')
      throw new ProbeError('RUNTIME_MISSING','Install exact prism-code@0.9.5 before running a holo');
    throw err;
  }
  if (pkg.version!=='0.9.5')
    throw new ProbeError('RUNTIME_VERSION','Expected prism-code@0.9.5, got '+pkg.version);
  const mod=await import('prism-code');
  if (!mod.prism?.containers?.run)
    throw new ProbeError('RUNTIME_API','Pinned Prism containers API missing');
  return mod.prism;
}
export async function evaluate(flags,loadRuntime=loadPinnedRuntime) {
  const identity=await artifact(flags['--holo'],flags['--sha256']);
  const runtime=await loadRuntime();
  const input=Uint8Array.from(Buffer.from(flags['--hex'],'hex'));
  let outcome;
  try {
    const c=await runtime.containers.run(identity.path,input,{
      policy:{minimum:'P0',effects:[]},rm:true
      // Deliberately NEVER allowUnverified: structural/policy refusal remains binding.
    });
    let response=null;
    if (c.output instanceof Uint8Array) {
      try {response=new TextDecoder('utf-8',{fatal:true}).decode(c.output);}
      catch { /* Invalid output cannot become a successful text result. */ }
    }
    const completed=c.status==='exited' && c.exitCode===0 && response!==null;
    outcome={status:completed?'GUEST_COMPLETED':'RUNTIME_REFUSED',exitCode:c.exitCode,
      response,responseHex:c.output instanceof Uint8Array?Buffer.from(c.output).toString('hex'):null};
  } catch(err) {outcome={status:'RUNTIME_ERROR',error:err?.code??'RUNTIME_ERROR'};}
  return {schema:'qortara/local-eligibility-result/1',application:'Qortara Skills Eligibility',
    artifact:identity,engine:'prism-code@0.9.5',requestHex:flags['--hex'].toLowerCase(),
    assurance:'P0 unverified; development fixtures only',productionEligible:false,...outcome};
}
const execFileAsync=promisify(execFile);
const SOURCE_ROOT=fileURLToPath(new URL('../',import.meta.url));

/**
 * Run the checked-in, read-only Python source inspector with bounded flags.
 * The Python module is the only C4/C5 coordinator; the Node CLI cannot
 * synthesize an eligible verdict or accept a model's rights self-assertion.
 */
export async function createRequest(flags,deps={}) {
  let outcome;
  if (deps.requestRunner) outcome=await deps.requestRunner(flags);
  else {
    const args=['-m','scripts.request_to_skill',
      '--request',flags['--request'],
      '--host',flags['--host'],
      '--handoff',flags['--handoff'],
      '--source-checkout',flags['--source-checkout']];
    if (flags['--route'])args.push('--route',flags['--route']);
    if (flags['--method'])args.push('--method',flags['--method']);
    if (flags['--external-checkout'])args.push(
      '--external-checkout',flags['--external-checkout'],
      '--external-repository-tree',flags['--external-repository-tree']);
    let stdout;
    try {
      ({stdout}=await execFileAsync(
        process.platform==='win32'?'python':'python3',args,
        {cwd:SOURCE_ROOT,shell:false,windowsHide:true,timeout:120_000,
         maxBuffer:4*1024*1024,
         env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1'}}));
    } catch(err) {
      // A correctly refused method deliberately exits 2. Everything else
      // must still fail closed; it must not turn into a success-shaped result.
      if (err?.code!==2 || typeof err.stdout!=='string' || !err.stdout.trim())
        throw new ProbeError('REQUEST_RUNTIME','Pinned corpus inspector unavailable or failed');
      stdout=err.stdout;
    }
    try {outcome=JSON.parse(stdout);}
    catch {throw new ProbeError('REQUEST_RUNTIME','Inspector produced invalid JSON');}
  }
  if (!outcome || outcome.schema!=='qortara/request-to-skill-evaluation/1' ||
      outcome.state!=='REFUSED_PRE_ADMISSION' ||
      outcome.refusal?.schema!=='qortara/skill-generation-refusal/1' ||
      outcome.refusal?.no_method_composed!==true ||
      outcome.prism_invoked!==false || outcome.composer_invoked!==false ||
      outcome.output_package_created!==false || outcome.production_eligible!==false)
    throw new ProbeError('UNTRUSTED_PROMOTION',
      'The request result tried to bypass source, rights, Prism or host qualification');
  return outcome;
}
export async function run(argv,deps={}) {
  const {command,flags}=parseCommand(argv);
  if (command==='help') return {kind:'text',value:USAGE,exitCode:0};
  if (command==='version') return {kind:'text',value:VERSION,exitCode:0};
  if (command==='status') {
    const value=await localStatus(flags,deps);
    return {kind:'json',value,exitCode:value.preflightReady?0:1};
  }
  if (command==='create') {
    const value=await createRequest(flags,deps);
    if (flags['--report'])
      await writeFile(flags['--report'],JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    return {kind:'json',value,exitCode:2};
  }
  if (command==='evaluate') {
    const value=await evaluate(flags,deps.loadRuntime);
    if (flags['--report'])
      await writeFile(flags['--report'],JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    return {kind:'json',value,exitCode:value.status==='GUEST_COMPLETED'?0:1};
  }
  const args=['--holo',flags['--holo'],'--sha256',flags['--sha256'],'--allow-p0'];
  if (flags['--case']) args.push('--case',flags['--case']);
  if (flags['--report']) args.push('--report',flags['--report']);
  const value=deps.loadRuntime?await probeMain(args,deps.loadRuntime):await probeMain(args);
  return {kind:'json',value,exitCode:value.verdict==='FIXTURE_PASS'?0:1};
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const result=await run(process.argv.slice(2));
    process.stdout.write((result.kind==='json'?JSON.stringify(result.value,null,2):result.value)+'\n');
    process.exitCode=result.exitCode;
  } catch(err) {
    process.stderr.write(JSON.stringify({code:err?.code??'UNEXPECTED',message:err?.message??String(err)})+'\n');
    process.exitCode=2;
  }
}
