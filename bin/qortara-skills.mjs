#!/usr/bin/env node
/**
 * Qortara Skills local Prism development CLI.
 * No skill generation, installation, inference, or alternate eligibility engine.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
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
  '--search','--path','--limit','--file','--lines','--review']);
const FLAG_BOOLEAN=new Set(['--allow-p0','--json','--summary','--all-first-party']);
const USAGE=[
 'Qortara Skills '+VERSION+' | local development-only Prism client',
 '',
 'Commands:',
 '  qortara-skills status [--holo FILE --sha256 SHA256] [--json]',
 '  qortara-skills evaluate --holo FILE --sha256 SHA256 --hex HEX --allow-p0 [--report NEW.json]',
 '  qortara-skills probe --holo FILE --sha256 SHA256 --allow-p0 [--case ID] [--report NEW.json]',
 '  qortara-skills create --request TEXT --route DOMAIN/SUBDOMAIN --host HOST --handoff DIR --source-checkout DIR [--method governed:ID] [--external-checkout DIR --external-repository-tree GIT_TREE] [--report NEW.json]',
 '  qortara-skills routes (--search TEXT [--limit 1..25] | --path DOMAIN/SUBDOMAIN | --summary) --handoff DIR --source-checkout DIR [--report NEW.json]',
 '  qortara-skills references (--all-first-party | --route DOMAIN/SUBDOMAIN [--method governed:ID [--file PACKAGE_PATH --lines FIRST:LAST]]) --handoff DIR --source-checkout DIR [--report NEW.json]',
 '  qortara-skills task-fit --review FILE --handoff DIR --source-checkout DIR [--report NEW.json]',
 '  qortara-skills version',
 '  qortara-skills help',
 '',
 'Requires Node.js 22+ and exact prism-code@0.9.5 to run a real holo.',
 '--allow-p0 is fixture-only consent, not trusted production assurance.',
 'Create verifies the exact pinned corpus and issues an actionable refusal until genuine approval exists.',
 'Create/routes/references/task-fit require Python 3.11+ and the separately pinned local skillz source checkout.',
 'References and task-fit inspect original sources, not admitted or host-qualified methods.',
 'Routes are lexical/explicit source navigation only, not semantic admission or reuse authorization.',
 'No approved SKILL.md generation, skill installation, or source-rights self-authorization.'
].join('\n');

export function parseCommand(argv) {
  if (!argv.length || argv[0]==='help' || (argv.length===1 && argv[0]==='--help'))
    return {command:'help',flags:{}};
  if (argv[0]==='version' && argv.length===1) return {command:'version',flags:{}};
  const [command,...args]=argv;
  if (!['status','evaluate','probe','create','routes','references','task-fit'].includes(command))
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
    : command==='references'
      ? ['--all-first-party','--route','--method','--file','--lines','--handoff','--source-checkout','--report']
    : command==='task-fit'
      ? ['--review','--handoff','--source-checkout','--report']
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
  if (command==='references' || command==='task-fit') {
    if (!flags['--handoff'] || !flags['--source-checkout'])
      throw new ProbeError('USAGE',command+' requires --handoff and --source-checkout');
  }
  if (command==='references') {
    if (Boolean(flags['--all-first-party'])===Boolean(flags['--route']))
      throw new ProbeError('USAGE','references requires one of --all-first-party or --route');
    if (flags['--all-first-party'] &&
        (flags['--method'] || flags['--file'] || flags['--lines']))
      throw new ProbeError('USAGE','all-first-party cannot select or quote a method');
    if (Boolean(flags['--file'])!==Boolean(flags['--lines']) ||
        (flags['--file'] && !flags['--method']))
      throw new ProbeError('USAGE','source line citations require --method, --file and --lines');
    if (flags['--method'] && !/^governed:[a-zA-Z0-9][a-zA-Z0-9_.\/-]{1,198}$/.test(flags['--method']))
      throw new ProbeError('USAGE','exact governed source record required');
    if (flags['--lines']) {
      const m=/^([1-9][0-9]{0,5}):([1-9][0-9]{0,5})$/.exec(flags['--lines']);
      if (!m || Number(m[2])<Number(m[1]) || Number(m[2])-Number(m[1])>=12)
        throw new ProbeError('USAGE','source quote requires 1-12 inclusive lines');
    }
  }
  if (command==='task-fit' && !flags['--review'])
    throw new ProbeError('USAGE','task-fit requires an exact source-review file');
  if (!['status','create','routes','references','task-fit'].includes(command)) {
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

const SOURCE_COMMIT='31a8c518dd97b7828adcc728202fa41388a306d7';
const SOURCE_TREE='e6d5dfeb42bcd7777ddff52605922fead62135ff';
const SOURCE_URL='https://github.com/Knapp-Kevin/skillz/blob/'+SOURCE_COMMIT+'/';
const sourceDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const refusalCode=x=>typeof x==='string' && /^[A-Z][A-Z0-9_]*$/.test(x);
const neverEligible=x=>x?.composition_eligible===false &&
  x?.production_eligible===false && x?.rights_qualified===false &&
  x?.host_validated===false && x?.prism_invoked===false;
const sourceCiteValid=x=>x && typeof x==='object' &&
  x.source_url?.startsWith(SOURCE_URL) &&
  x.exact_excerpt_sha256===sourceDigest(x.original_lines_for_review??'');
/** Resolve caller-relative source and review paths; Python is a fixed module, no shell. */
export function referencePythonArgs(flags,callerDirectory=process.cwd()) {
  const args=['-m','scripts.corpus_reference_dossier',
    '--handoff',resolve(callerDirectory,flags['--handoff']),
    '--source-checkout',resolve(callerDirectory,flags['--source-checkout'])];
  if (flags['--all-first-party'])args.push('--all-first-party');
  else {
    args.push('--route',flags['--route']);
    if (flags['--method'])args.push('--method',flags['--method']);
    if (flags['--file'])args.push('--file',flags['--file'],'--lines',flags['--lines']);
  }
  return args;
}
export function taskFitPythonArgs(flags,callerDirectory=process.cwd()) {
  return ['-m','scripts.source_task_fit_review',
    '--handoff',resolve(callerDirectory,flags['--handoff']),
    '--source-checkout',resolve(callerDirectory,flags['--source-checkout']),
    '--review',resolve(callerDirectory,flags['--review'])];
}
async function callSourcePython(args,code) {
  let stdout;
  try {
    ({stdout}=await execFileAsync(process.platform==='win32'?'python':'python3',args,
      {cwd:SOURCE_ROOT,shell:false,windowsHide:true,timeout:120_000,
       maxBuffer:8*1024*1024,
       env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1'}}));
  }catch(err){
    if (err?.code!==2 || typeof err.stdout!=='string' || !err.stdout.trim())
      throw new ProbeError(code,'Exact pinned original-source inspector failed');
    stdout=err.stdout;
  }
  try{return JSON.parse(stdout);}
  catch{throw new ProbeError(code,'Original-source inspector returned invalid JSON');}
}
function checkSourceRefusal(output,code) {
  if (output?.state!=='REFUSED')return false;
  if (!refusalCode(output.code) || output.composition_eligible!==false ||
      !['qortara/original-source-reference-dossier/1',
         'qortara/source-task-fit-reference-review/1'].includes(output.schema))
    throw new ProbeError(code,'Malformed source-inspection refusal');
  return true;
}
/** Source material only: never return a generated/accepted-method verdict. */
export async function inspectReferences(flags,deps={}) {
  const output=deps.referenceRunner?await deps.referenceRunner(flags):
    await callSourcePython(referencePythonArgs(flags),'REFERENCE_RUNTIME');
  if (checkSourceRefusal(output,'REFERENCE_RUNTIME'))return output;
  const core=output?.exact_source_commit===SOURCE_COMMIT &&
    output.exact_source_tree===SOURCE_TREE &&
    neverEligible(output);
  if (!core)throw new ProbeError('REFERENCE_PROMOTION','Source result is not a pinned read-only review');
  if (flags['--all-first-party']) {
    if (output.schema!=='qortara/first-party-source-reference-inventory/1' ||
        output.state!=='FULL_PINNED_FIRST_PARTY_SOURCE_REVIEW_QUEUE' ||
        output.total_original_first_party_review_records!==48 ||
        output.all_pinned_first_party_review_records_retained!==true ||
        !Array.isArray(output.original_source_reference_records) ||
        output.original_source_reference_records.length!==48 ||
        output.original_source_reference_records.some(x=>
          x.rights_assessed!==false || x.method_scope_qualified!==false ||
          x.host_validated!==false || x.composition_eligible!==false ||
          !x.governed_review_id?.startsWith('governed:')))
      throw new ProbeError('REFERENCE_PROMOTION','Unverified first-party inventory response');
    const ids=output.original_source_reference_records.map(x=>x.governed_review_id);
    if (new Set(ids).size!==48 ||
        output.route_linked_record_count+output.unmapped_review_record_count!==48)
      throw new ProbeError('REFERENCE_PROMOTION','First-party records missing or duplicated');
    return output;
  }
  if (output.schema!=='qortara/original-source-reference-dossier/1' ||
      output.state!=='SOURCE_REFERENCE_MATERIAL_FOR_HUMAN_QUALIFICATION' ||
      output.route!==flags['--route'] ||
      output.selected_method_for_source_inspection_only!==(flags['--method']??null) ||
      output.method_selected_for_composition!==null ||
      output.outcome_coverage_qualified!==false ||
      !Array.isArray(output.candidates) ||
      output.linked_governed_review_count!==output.candidates.length ||
      output.candidates.some(x=>
        x.rights_qualified!==false || x.host_validated!==false ||
        x.method_scope_qualified!==false || x.composition_eligible!==false ||
        x.original_package && (x.original_package.redistribution_rights_proven!==false ||
          x.original_package.full_dependency_closure_proven!==false ||
          x.original_package.complete_source_bytes_verified!==true)))
    throw new ProbeError('REFERENCE_PROMOTION','Source dossier attempted to promote unqualified methods');
  const quote=output.original_source_citation;
  if (flags['--lines']) {
    if (!quote || quote.governed_review_id!==flags['--method'] ||
        quote.first_line+':'+quote.last_line!==flags['--lines'] ||
        !quote.path.endsWith('/'+flags['--file']) ||
        quote.source_url!==SOURCE_URL+quote.path+'#L'+quote.first_line+'-L'+quote.last_line ||
        quote.exact_original_lines_for_human_review==null ||
        quote.exact_source_excerpt_sha256!==sourceDigest(quote.exact_original_lines_for_human_review))
      throw new ProbeError('REFERENCE_PROMOTION','Original source citation mismatch');
  } else if (quote!==null) {
    throw new ProbeError('REFERENCE_PROMOTION','Unrequested source text in dossier');
  }
  return output;
}
/** Reviewer-authored proposed task-fit; quotes are checked, not semantically certified. */
export async function inspectTaskFit(flags,deps={}) {
  const output=deps.taskFitRunner?await deps.taskFitRunner(flags):
    await callSourcePython(taskFitPythonArgs(flags),'TASK_FIT_RUNTIME');
  if (checkSourceRefusal(output,'TASK_FIT_RUNTIME'))return output;
  if (output?.schema!=='qortara/source-task-fit-reference-review/1' ||
      output.state!=='BOUNDED_ORIGINAL_SOURCE_TASK_REFERENCE_NOT_ADMITTED' ||
      output.source_snapshot_commit!==SOURCE_COMMIT ||
      output.source_snapshot_tree!==SOURCE_TREE ||
      !neverEligible(output) || output.outcome_coverage_qualified!==false ||
      output.operator_source_acceptance_signed!==false ||
      output.actual_consumer_host_task_runs!==0 ||
      output.source_quotes_prove_bytes_not_reviewers_semantic_conclusion!==true ||
      !Array.isArray(output.source_evidence) ||
      output.source_evidence.length<4 ||
      !output.source_evidence.every(sourceCiteValid) ||
      new Set(output.source_evidence.map(x=>x.role)).size!==4 ||
      !['TRIGGER_AND_LIMIT','METHOD_STEPS','EVIDENCE_AND_REPORT','SAFETY_BOUNDARY']
        .every(role=>output.source_evidence.some(x=>x.role===role)) ||
      !Array.isArray(output.reviewer_proposed_task_spec_not_an_admitted_method?.acceptance_scenarios) ||
      output.acceptance_scenarios_planned_not_executed!==
        output.reviewer_proposed_task_spec_not_an_admitted_method.acceptance_scenarios.length)
    throw new ProbeError('TASK_FIT_PROMOTION','Untrusted task-fit response cannot establish source, rights or host approval');
  return output;
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
  if (command==='references' || command==='task-fit') {
    const value=command==='references'?
      await inspectReferences(flags,deps):await inspectTaskFit(flags,deps);
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
