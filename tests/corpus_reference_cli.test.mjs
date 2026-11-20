/** Original Skillz reference and task-fit CLI contract, no source execution or rights. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parseCommand,referencePythonArgs,taskFitPythonArgs,inspectReferences,
  inspectTaskFit,run} from '../bin/qortara-skills.mjs';

const COMMIT='31a8c518dd97b7828adcc728202fa41388a306d7';
const TREE='e6d5dfeb42bcd7777ddff52605922fead62135ff';
const PREFIX='https://github.com/Knapp-Kevin/skillz/blob/'+COMMIT+'/';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const PATH='security/supply-chain';
const METHOD='governed:local-skills/mcp-vetting';
const base=['--handoff','../handoff','--source-checkout','../source'];
const routeArgs=['references','--route',PATH,...base];
const fullArgs=['references','--all-first-party',...base];
const taskArgs=['task-fit','--review','../review.json',...base];
const safety={composition_eligible:false,production_eligible:false,
  rights_qualified:false,host_validated:false,prism_invoked:false};
const c={
  governed_review_id:METHOD,source_class:'first-party',recorded_static_review:'verified',
  inspection_state:'PINNED_FIRST_PARTY_PACKAGE_BYTES_VERIFIED',
  rights_qualified:false,host_validated:false,method_scope_qualified:false,
  composition_eligible:false,
  original_package:{complete_source_bytes_verified:true,
    redistribution_rights_proven:false,full_dependency_closure_proven:false},
};
const route={
  schema:'qortara/original-source-reference-dossier/1',
  state:'SOURCE_REFERENCE_MATERIAL_FOR_HUMAN_QUALIFICATION',
  exact_source_commit:COMMIT,exact_source_tree:TREE,
  route:PATH,selected_method_for_source_inspection_only:null,
  method_selected_for_composition:null,outcome_coverage_qualified:false,
  linked_governed_review_count:1,candidates:[c],
  original_source_citation:null,...safety,
};
const inv={
  schema:'qortara/first-party-source-reference-inventory/1',
  state:'FULL_PINNED_FIRST_PARTY_SOURCE_REVIEW_QUEUE',
  exact_source_commit:COMMIT,exact_source_tree:TREE,
  total_original_first_party_review_records:48,
  all_pinned_first_party_review_records_retained:true,
  route_linked_record_count:48,unmapped_review_record_count:0,
  original_source_reference_records:Array.from({length:48},(_,i)=>({
    governed_review_id:'governed:original/'+String(i).padStart(3,'0'),
    rights_assessed:false,method_scope_qualified:false,
    host_validated:false,composition_eligible:false,
  })),...safety,
};
const excerpt='Review exact source.\n';
const quote={
  governed_review_id:METHOD,path:'skills/mcp-vetting/SKILL.md',
  first_line:2,last_line:2,
  source_url:PREFIX+'skills/mcp-vetting/SKILL.md#L2-L2',
  exact_original_lines_for_human_review:excerpt,
  exact_source_excerpt_sha256:SHA(excerpt),
};
const roles=['TRIGGER_AND_LIMIT','METHOD_STEPS','EVIDENCE_AND_REPORT','SAFETY_BOUNDARY'];
const fit={
  schema:'qortara/source-task-fit-reference-review/1',
  state:'BOUNDED_ORIGINAL_SOURCE_TASK_REFERENCE_NOT_ADMITTED',
  source_snapshot_commit:COMMIT,source_snapshot_tree:TREE,
  source_quotes_prove_bytes_not_reviewers_semantic_conclusion:true,
  outcome_coverage_qualified:false,operator_source_acceptance_signed:false,
  actual_consumer_host_task_runs:0,
  source_evidence:roles.map(role=>({role,
    source_url:PREFIX+'skills/mcp-vetting/SKILL.md#L2-L2',
    exact_excerpt_sha256:SHA(excerpt),original_lines_for_review:excerpt})),
  reviewer_proposed_task_spec_not_an_admitted_method:{
    acceptance_scenarios:Array.from({length:5},(_,i)=>({id:'scenario-'+i}))},
  acceptance_scenarios_planned_not_executed:5,...safety,
};

test('real-user interface gives 48-source overview and route-specific original references',async()=>{
  const overview=await run(fullArgs,{referenceRunner:async()=>inv});
  assert.equal(overview.exitCode,0);
  assert.equal(overview.value.original_source_reference_records.length,48);
  const current=await run(routeArgs,{referenceRunner:async()=>route});
  assert.equal(current.exitCode,0);
  assert.equal(current.value.linked_governed_review_count,1);
  assert.equal(current.value.candidates[0].method_scope_qualified,false);
});
test('source citation only returned when explicitly requested and bound to selected ID',async()=>{
  const args=['references','--route',PATH,'--method',METHOD,
    '--file','SKILL.md','--lines','2:2',...base];
  const result={...route,selected_method_for_source_inspection_only:METHOD,
    original_source_citation:quote};
  assert.equal((await run(args,{referenceRunner:async()=>result})).exitCode,0);
  await assert.rejects(inspectReferences(parseCommand(routeArgs).flags,
    {referenceRunner:async()=>result}),{code:'REFERENCE_PROMOTION'});
  for(const tamper of [
    {...result,original_source_citation:{...quote,exact_original_lines_for_human_review:'tamper'}},
    {...result,original_source_citation:{...quote,source_url:'https://evil.invalid/a'}},
    {...result,original_source_citation:{...quote,governed_review_id:'governed:other'}},
    {...result,original_source_citation:{...quote,first_line:3}},
  ])await assert.rejects(inspectReferences(parseCommand(args).flags,
    {referenceRunner:async()=>tamper}),{code:'REFERENCE_PROMOTION'});
});
test('original 48-source queue rejects missing records, swapped pins and promoted methods',async()=>{
  for(const bad of [
    {...inv,total_original_first_party_review_records:47},
    {...inv,original_source_reference_records:inv.original_source_reference_records.slice(1)},
    {...inv,original_source_reference_records:[inv.original_source_reference_records[0],
      ...inv.original_source_reference_records.slice(0,47)]},
    {...inv,rights_qualified:true},
    {...inv,exact_source_commit:'f'.repeat(40)},
    {...inv,original_source_reference_records:inv.original_source_reference_records.map((x,i)=>
      i===0?{...x,method_scope_qualified:true}:x)},
  ])await assert.rejects(inspectReferences(parseCommand(fullArgs).flags,
    {referenceRunner:async()=>bad}),{code:'REFERENCE_PROMOTION'});
  await assert.rejects(inspectReferences(parseCommand(routeArgs).flags,
    {referenceRunner:async()=>({...route,candidates:[{...c,composition_eligible:true}]})}),
    {code:'REFERENCE_PROMOTION'});
});
test('task-fit CLI returns review-owned acceptance criteria but cannot certify them',async()=>{
  const result=await run(taskArgs,{taskFitRunner:async()=>fit});
  assert.equal(result.exitCode,0);
  assert.equal(result.value.acceptance_scenarios_planned_not_executed,5);
  assert.equal(result.value.actual_consumer_host_task_runs,0);
  assert.equal(result.value.production_eligible,false);
});
test('source task-fit cannot admit forged positive rights, host proof or evidence bytes',async()=>{
  const flags=parseCommand(taskArgs).flags;
  for(const bad of [
    {...fit,operator_source_acceptance_signed:true},
    {...fit,outcome_coverage_qualified:true},
    {...fit,actual_consumer_host_task_runs:2},
    {...fit,host_validated:true},
    {...fit,source_snapshot_tree:'f'.repeat(40)},
    {...fit,source_evidence:fit.source_evidence.map((x,i)=>
      i===0?{...x,original_lines_for_review:'replacement'}:x)},
    {...fit,source_evidence:fit.source_evidence.map(x=>({...x,role:'METHOD_STEPS'}))},
    {...fit,acceptance_scenarios_planned_not_executed:6},
  ])await assert.rejects(inspectTaskFit(flags,{taskFitRunner:async()=>bad}),
    {code:'TASK_FIT_PROMOTION'});
});
test('flag parser prevents source-citation sprawl or unapproved evaluation parameters',()=>{
  const bad=[
    ['references',...base],
    ['references','--route',PATH,'--all-first-party',...base],
    ['references','--all-first-party','--method',METHOD,...base],
    ['references','--route',PATH,'--lines','1:2',...base],
    ['references','--route',PATH,'--method',METHOD,'--file','SKILL.md',...base],
    ['references','--route',PATH,'--method','governed:','--file','SKILL.md','--lines','2:3',...base],
    ['references','--route',PATH,'--method',METHOD,'--file','SKILL.md','--lines','1:13',...base],
    ['references','--route',PATH,'--method',METHOD,'--file','SKILL.md','--lines','3:2',...base],
    ['references','--route',PATH,'--allow-p0',...base],
    ['task-fit',...base],
    ['task-fit','--review','../../fixture.json','--allow-p0',...base],
  ];
  for(const args of bad) assert.throws(()=>parseCommand(args),{code:'USAGE'});
});
test('all source paths are caller-relative argv, never shell fragments or CWD guesswork',()=>{
  const caller=join(tmpdir(),'external developer');
  const a=parseCommand(['references','--route',PATH,'--method',METHOD,
    '--file','SKILL.md','--lines','17:21',...base]).flags;
  const argv=referencePythonArgs(a,caller);
  assert.equal(argv[1],'scripts.corpus_reference_dossier');
  assert.equal(argv[argv.indexOf('--handoff')+1],resolve(caller,'../handoff'));
  assert.equal(argv[argv.indexOf('--source-checkout')+1],resolve(caller,'../source'));
  assert.equal(argv[argv.indexOf('--method')+1],METHOD);
  assert.equal(argv[argv.indexOf('--file')+1],'SKILL.md');
  assert.equal(argv[argv.indexOf('--lines')+1],'17:21');
  const b=taskFitPythonArgs(parseCommand(taskArgs).flags,caller);
  assert.equal(b[1],'scripts.source_task_fit_review');
  assert.equal(b[b.indexOf('--review')+1],resolve(caller,'../review.json'));
});
test('correct source denial stays exit 2 and report never overwrites evidence',async()=>{
  const denial={schema:'qortara/original-source-reference-dossier/1',
    state:'REFUSED',code:'UNKNOWN_ROUTE',composition_eligible:false};
  const flags={referenceRunner:async()=>denial};
  assert.equal((await run(routeArgs,flags)).exitCode,2);
  await assert.rejects(inspectReferences(parseCommand(routeArgs).flags,
    {referenceRunner:async()=>({...denial,composition_eligible:true})}),
    {code:'REFERENCE_RUNTIME'});
  const dir=await mkdtemp(join(tmpdir(),'qortara-reference-'));
  const destination=join(dir,'original-references.json');
  try{
    const args=[...fullArgs,'--report',destination];
    assert.equal((await run(args,{referenceRunner:async()=>inv})).exitCode,0);
    assert.deepEqual(JSON.parse(await readFile(destination,'utf8')),inv);
    await assert.rejects(run(args,{referenceRunner:async()=>inv}),{code:'EEXIST'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
