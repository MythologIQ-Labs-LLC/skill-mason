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
  '--external-checkout','--external-repository-tree',
  '--search','--path','--limit']);
const FLAG_BOOLEAN=new Set(['--allow-p0','--json','--summary']);
const USAGE=[
 'Qortara Skills '+VERSION+' | local development-only Prism client',
 '',
 'Commands:',
 '  qortara-skills status [--holo FILE --sha256 SHA256] [--json]',
 '  qortara-skills evaluate --holo FILE --sha256 SHA256 --hex HEX --allow-p0 [--report NEW.json]',
 '  qortara-skills probe --holo FILE --sha256 SHA256 --allow-p0 [--case ID] [--report NEW.json]',
 '  qortara-skills create --request TEXT --route DOMAIN/SUBDOMAIN --host HOST --handoff DIR --source-checkout DIR [--method governed:ID] [--external-checkout DIR --external-repository-tree GIT_TREE] [--report NEW.json]',
 '  qortara-skills routes (--search TEXT [--limit 1..25] | --path DOMAIN/SUBDOMAIN | --summary) --handoff DIR --source-checkout DIR [--report NEW.json]',
 '  qortara-skills preview --request TEXT --handoff DIR --source-checkout DIR [--limit 1..3] [--report NEW.json] (unassessed leads; manual choice required)',
 '  qortara-skills version',
 '  qortara-skills help',
 '',
 'Requires Node.js 22+ and exact prism-code@0.9.5 to run a real holo.',
 '--allow-p0 is fixture-only consent, not trusted production assurance.',
 'Create verifies the exact pinned corpus and issues an actionable refusal until genuine approval exists.',
 'Create/routes require Python 3.11+ and the separately pinned local skillz source checkout.',
 'Routes are lexical/explicit source navigation only, not semantic admission or reuse authorization.',
 'Preview is EXPERIMENTAL and never chooses a route; negation/ambiguity handling is unverified.',
 'No approved SKILL.md generation, skill installation, or source-rights self-authorization.'
].join('\n');

export function parseCommand(argv) {
  if (!argv.length || argv[0]==='help' || (argv.length===1 && argv[0]==='--help'))
    return {command:'help',flags:{}};
  if (argv[0]==='version' && argv.length===1) return {command:'version',flags:{}};
  const [command,...args]=argv;
  if (!['status','evaluate','probe','create','routes','preview'].includes(command))
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
    : command==='routes'
      ? ['--search','--path','--summary','--limit','--handoff','--source-checkout','--report']
    : command==='preview'
      ? ['--request','--limit','--handoff','--source-checkout','--report']
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
  if (command==='routes') {
    if (!flags['--handoff'] || !flags['--source-checkout'])
      throw new ProbeError('USAGE','routes requires --handoff and --source-checkout');
    const count=Number(Boolean(flags['--search']))+
      Number(Boolean(flags['--path']))+Number(Boolean(flags['--summary']));
    if (count!==1) throw new ProbeError('USAGE','routes requires exactly one --search, --path or --summary');
    if (flags['--limit']!==undefined &&
        (!flags['--search'] || !/^(?:[1-9]|1\d|2[0-5])$/.test(flags['--limit'])))
      throw new ProbeError('USAGE','--limit must be 1..25 and valid only with --search');
  }
  if (command==='preview') {
    if (!flags['--request'] || !flags['--handoff'] || !flags['--source-checkout'])
      throw new ProbeError('USAGE','preview needs --request, --handoff and --source-checkout');
    if (flags['--limit']!==undefined && !/^[1-3]$/.test(flags['--limit']))
      throw new ProbeError('USAGE','preview limits unassessed leads to 1..3');
  }
  if (command!=='status' && command!=='create' && command!=='routes' && command!=='preview') {
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
/**
 * Preserve the invoking operator's filesystem context even though Python
 * needs to import its verified module from the Skill Mason repository root.
 */
export function requestPythonArgs(flags,callerDirectory=process.cwd()) {
  const args=['-m','scripts.request_to_skill',
    '--request',flags['--request'],
    '--host',flags['--host'],
    '--handoff',resolve(callerDirectory,flags['--handoff']),
    '--source-checkout',resolve(callerDirectory,flags['--source-checkout'])];
  if (flags['--route'])args.push('--route',flags['--route']);
  if (flags['--method'])args.push('--method',flags['--method']);
  if (flags['--external-checkout'])args.push(
    '--external-checkout',resolve(callerDirectory,flags['--external-checkout']),
    '--external-repository-tree',flags['--external-repository-tree']);
  return args;
}
/** Caller-relative verified corpus navigation. Does not select methods or grant reuse. */
export function routePythonArgs(flags,callerDirectory=process.cwd()) {
  const args=['-m','scripts.user_route_discovery',
    '--handoff',resolve(callerDirectory,flags['--handoff']),
    '--source-checkout',resolve(callerDirectory,flags['--source-checkout'])];
  if (flags['--search']) args.push('--search',flags['--search']);
  if (flags['--path']) args.push('--path',flags['--path']);
  if (flags['--summary']) args.push('--summary');
  if (flags['--limit']) args.push('--limit',flags['--limit']);
  return args;
}
export async function discoverRoutes(flags,deps={}) {
  let output;
  if (deps.routeRunner) output=await deps.routeRunner(flags);
  else {
    let stdout;
    try {
      ({stdout}=await execFileAsync(
        process.platform==='win32'?'python':'python3',routePythonArgs(flags),
        {cwd:SOURCE_ROOT,shell:false,windowsHide:true,timeout:120_000,
         maxBuffer:4*1024*1024,
         env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1'}}));
    } catch(err) {
      if (err?.code!==2 || typeof err.stdout!=='string' || !err.stdout.trim())
        throw new ProbeError('ROUTE_RUNTIME','Pinned capability graph unavailable or failed');
      stdout=err.stdout;
    }
    try {output=JSON.parse(stdout);}
    catch {throw new ProbeError('ROUTE_RUNTIME','Capability graph did not return valid JSON');}
  }
  if (output?.schema!=='qortara/user-route-discovery/1' ||
      output.production_eligible!==false || output.composition_eligible!==false)
    throw new ProbeError('ROUTE_PROMOTION','Untrusted capability response cannot establish eligibility');
  if (output.state==='REFUSED') {
    if (!/^[A-Z][A-Z0-9_]*$/.test(output.code??''))
      throw new ProbeError('ROUTE_RUNTIME','Invalid read-only route refusal');
    return output;
  }
  const expectedMode=flags['--summary']?'SUMMARY':flags['--path']?'SHOW':'SEARCH';
  if (output.state!=='READ_ONLY_RECOGNIZED_CAPABILITIES' ||
      output.mode!==expectedMode ||
      output.pinned_source_commit!=='31a8c518dd97b7828adcc728202fa41388a306d7' ||
      output.pinned_source_tree!=='e6d5dfeb42bcd7777ddff52605922fead62135ff' ||
      output.recognized_domain_count!==33 ||
      output.recognized_route_count!==247 ||
      output.search_is_lexical_not_qualified_semantics!==true ||
      output.source_rights_established!==false ||
      output.host_validated!==false ||
      !Array.isArray(output.routes) ||
      output.routes.length>(flags['--search']?Number(flags['--limit']??10):flags['--path']?1:0) ||
      (expectedMode==='SHOW' && (output.routes.length!==1 || output.routes[0].path!==flags['--path'])) ||
      (expectedMode==='SUMMARY' && output.routes.length!==0) ||
      !output.routes.every(r=>r?.schema==='qortara/capability-opportunity-graph/1' &&
        r?.source_commit===output.pinned_source_commit &&
        r?.recognized===true && r?.composition_eligible===false &&
        Array.isArray(r.evidence_linked_reviews) &&
        r.evidence_linked_reviews.every(x=>x?.composition_eligibility==='not-assessed' &&
          x?.rights_clearance==='not-established')))
    throw new ProbeError('ROUTE_PROMOTION','Route graph attempted to bypass read-only source boundary');
  return output;
}
/** Optional experimental lexical lead preview, never source/route approval. */
export function previewPythonArgs(flags,callerDirectory=process.cwd()) {
  const args=['-m','scripts.manual_route_preview',
    '--request',flags['--request'],
    '--handoff',resolve(callerDirectory,flags['--handoff']),
    '--source-checkout',resolve(callerDirectory,flags['--source-checkout'])];
  if (flags['--limit']) args.push('--limit',flags['--limit']);
  return args;
}
export async function previewRoutes(flags,deps={}) {
  let value;
  if (deps.previewRunner) value=await deps.previewRunner(flags);
  else {
    let stdout;
    try {
      ({stdout}=await execFileAsync(
        process.platform==='win32'?'python':'python3',previewPythonArgs(flags),
        {cwd:SOURCE_ROOT,shell:false,windowsHide:true,timeout:120_000,
         maxBuffer:4*1024*1024,env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1'}}));
    } catch(err) {
      if (err?.code!==2 || typeof err.stdout!=='string' || !err.stdout.trim())
        throw new ProbeError('PREVIEW_RUNTIME','Pinned preview source unavailable or failed');
      stdout=err.stdout;
    }
    try {value=JSON.parse(stdout);}
    catch {throw new ProbeError('PREVIEW_RUNTIME','Preview did not return valid JSON');}
  }
  if (value?.schema!=='qortara/manual-route-preview/1' ||
      value.production_eligible!==false || value.composition_eligible!==false)
    throw new ProbeError('PREVIEW_PROMOTION','Preview must never grant eligibility');
  if (value.state==='REFUSED') {
    if (!/^[A-Z][A-Z0-9_]*$/.test(value.code??''))
      throw new ProbeError('PREVIEW_RUNTIME','Invalid preview refusal');
    return value;
  }
  const limit=Number(flags['--limit']??3);
  if (!['LEADS_REQUIRE_USER_CHOICE','ABSTAIN_NO_AUTOMATIC_ROUTE'].includes(value.state) ||
      value.pinned_source_commit!=='31a8c518dd97b7828adcc728202fa41388a306d7' ||
      value.pinned_source_tree!=='e6d5dfeb42bcd7777ddff52605922fead62135ff' ||
      value.proposal_source_sha256!=='2a9bd2c6efb50cd222c87ce73e787a5fcdccc7a67a278a838d610ba7dddcb345' ||
      value.route_universe!=='13_UNGOVERNED_WORKFLOW_DESCRIPTIONS_WITHIN_247_RECOGNIZED_ROUTES' ||
      value.evaluated_route_count!==13 || value.recognized_route_count!==247 ||
      value.candidate_method_count!==0 ||
      value.suggestion_quality!=='EXPERIMENTAL_AUTHOR_LABELED_REPLAY_FAILED_NEGATED_AMBIGUOUS' ||
      value.semantic_negation_handling_verified!==false ||
      value.user_must_explicitly_select_route!==true || value.selected_route!==null ||
      value.source_rights_established!==false || value.host_authority_established!==false ||
      value.prism_invoked!==false || value.composer_invoked!==false ||
      value.output_package_created!==false ||
      !/^[0-9a-f]{64}$/.test(value.request_sha256??'') ||
      !Array.isArray(value.unapproved_route_leads) ||
      value.unapproved_route_leads.length>limit ||
      (value.state==='ABSTAIN_NO_AUTOMATIC_ROUTE' && value.unapproved_route_leads.length!==0) ||
      (value.state==='LEADS_REQUIRE_USER_CHOICE' && value.unapproved_route_leads.length===0) ||
      new Set(value.unapproved_route_leads.map(x=>x.route)).size!==value.unapproved_route_leads.length ||
      !value.unapproved_route_leads.every(x=>
        typeof x.route==='string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(x.route) &&
        x.review_status==='UNASSESSED_LEXICAL_LEAD_NOT_A_METHOD_OR_APPROVAL' &&
        typeof x.similarity_score_not_confidence==='number' &&
        x.similarity_score_not_confidence>=0 && x.similarity_score_not_confidence<=1 &&
        Number.isInteger(x.shared_content_token_count) && x.shared_content_token_count>=2))
    throw new ProbeError('PREVIEW_PROMOTION','Untrusted preview attempted route selection or eligibility');
  return value;
}

export async function createRequest(flags,deps={}) {
  let outcome;
  if (deps.requestRunner) outcome=await deps.requestRunner(flags);
  else {
    const args=requestPythonArgs(flags);
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
  if (command==='routes') {
    const value=await discoverRoutes(flags,deps);
    if (flags['--report'])
      await writeFile(flags['--report'],JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    return {kind:'json',value,exitCode:value.state==='REFUSED'?2:0};
  }
  if (command==='preview') {
    const value=await previewRoutes(flags,deps);
    if (flags['--report'])
      await writeFile(flags['--report'],JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    return {kind:'json',value,exitCode:value.state==='REFUSED'?2:0};
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
