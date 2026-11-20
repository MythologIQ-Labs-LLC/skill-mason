/**
 * Public, key-free, read-only four-arm task trial.
 * This is an instruction preview, NOT an approved Agent Skill package,
 * no fixture signing, no mocked Prism, no production admission.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRecipeAdapter} from '../backend/recipe-adapter.mjs';
import {renderUnqualifiedTrialPreview} from '../backend/compose.mjs';
import {
  loadFirstPartyPilots,recipeForPilot,PILOT_HOST
} from '../backend/first-party-pilots.mjs';
import {compareFourRawResponseArms}
  from './ci-release-combined-score.mjs';

export const PUBLIC_TRIAL_SCHEMA='qortara/public-four-arm-source-trial/1';
export const PUBLIC_RESPONSES_SCHEMA='qortara/public-four-arm-host-responses/1';
const ARM_IDS=['baseline','ci_only','release_only','combined'];
const METHOD_IDS=['ci-failure-triage-v5','release-readiness-review-v2'];
const HASH=/^[0-9a-f]{64}$/;
const sha=v=>createHash('sha256').update(v).digest('hex');
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const exact=(x,fields)=>isPlain(x)&&Object.keys(x).sort().join('|')===
  [...fields].sort().join('|');
const format='Return CI_STATE, RELEASE_DECISION, EVIDENCE_IDS, ACTIONS_EXECUTED and a concise evidence-grounded FINDINGS paragraph. Cite only supplied evidence IDs. Never execute commands, use secrets or invent unavailable facts.';
export async function loadOriginalPublicTrialCases(){
 const text=await readFile(new URL('../../tests/fixtures/combined-ci-release-boundaries-v1.json',import.meta.url),'utf8');
 const cases=JSON.parse(text);
 if(cases?.schema!=='qortara/combined-ci-release-task-cases/1'||
    !Array.isArray(cases.cases)||cases.cases.length!==8)
  fail('PUBLIC_TRIAL_CASES','expected exactly eight original challenge cases');
 return cases;
}
function buildRecipe(registry,ids){
 if(ids.length===1)return recipeForPilot(ids[0],registry);
 const selected=ids.map(id=>registry.components.find(e=>e.method_id===id));
 if(selected.some(x=>!x))fail('PUBLIC_TRIAL_SOURCE','missing original first-party method');
 return {
  schema_version:'skill-mason.recipe.v0',
  skill_id:'ci-release-review',
  title:'CI and release evidence review',
  description:'Read-only revision-aware CI diagnosis and independently evidenced release review.',
  target_host:PILOT_HOST,
  required_outcomes:selected.map(e=>e.method.covers[0]),
  source_snapshot:{...registry.sourceSnapshot},
  components:selected.map(e=>({
   method_id:e.method_id,package_id:e.package_id,
   package_sha256:e.package_sha256
  })),
  authority:{network:false,secrets:false,execution:false}
 };
}
/** All three preview arms come from the same immutable source method loader. */
export async function buildPublicFourArmTrial(){
 const registry=await loadFirstPartyPilots();
 const adapt=createRecipeAdapter(registry);
 const arms={baseline:null};
 for(const [arm,ids] of [
  ['ci_only',[METHOD_IDS[0]]],
  ['release_only',[METHOD_IDS[1]]],
  ['combined',METHOD_IDS]
 ]){
  const {plan,methods}=adapt(buildRecipe(registry,ids));
  const preview=renderUnqualifiedTrialPreview(plan,methods);
  if(preview.prismInvoked!==false||preview.sourceReuseRightsApproved!==false||
     preview.hostSkillInstalled!==false||preview.productionEligible!==false||
     preview.methodPins.length!==ids.length||
     !ids.every(id=>preview.methodPins.some(m=>m.id===id)))
    fail('PUBLIC_TRIAL_PROMOTION','preview claimed approved or altered source methods');
  arms[arm]=preview;
 }
 const cases=await loadOriginalPublicTrialCases();
 const tasks=cases.cases.map(c=>({
  id:c.id,prompt:c.prompt,
  evidence:c.evidence.map(({id,text})=>({id,text})),
  formatInstructions:format
 }));
 return {
  schema:PUBLIC_TRIAL_SCHEMA,
  state:'SOURCE_PINNED_PREVIEW_NOT_AN_APPROVED_OR_HOST_TESTED_SKILL',
  corpusSourceSnapshotCommit:registry.sourceSnapshot.commit,
  corpusSourceSnapshotSha256:registry.sourceSnapshot.sha256,
  arms,tasks,
  taskCount:tasks.length,armTaskCount:tasks.length*ARM_IDS.length,
  answerOraclesIncluded:false,
  modelCalls:0,prismInvoked:false,sourceRightsApproved:false,
  hostObserved:false,hostSkillInstalled:false,productionEligible:false
 };
}
/**
 * A reviewer can score *operator-recorded* actual host replies with no
 * dependence on signing keys. Host identity remains self-reported/unattested.
 */
export async function scorePublicFourArmTrial({responses}={}){
 if(!exact(responses,['schema','previewSha256ByArm','arms'])||
    responses.schema!==PUBLIC_RESPONSES_SCHEMA||
    !exact(responses.previewSha256ByArm,ARM_IDS)||
    !exact(responses.arms,ARM_IDS))
  fail('PUBLIC_TRIAL_RESPONSES','expected complete original four-arm response envelope');
 const preview=await buildPublicFourArmTrial();
 if(responses.previewSha256ByArm.baseline!==null)
  fail('PUBLIC_TRIAL_PREVIEW_PIN','baseline must have no instruction bytes');
 for(const arm of ARM_IDS.slice(1)){
  const expected=preview.arms[arm].contentSha256;
  if(!HASH.test(responses.previewSha256ByArm[arm])||
     responses.previewSha256ByArm[arm]!==expected)
    fail('PUBLIC_TRIAL_PREVIEW_PIN','wrong original source-pinned instructions for '+arm);
 }
 const cases=await loadOriginalPublicTrialCases();
 const rated=compareFourRawResponseArms({cases,arms:responses.arms});
 return {
  schema:'qortara/public-four-arm-structural-results/1',
  state:'RECORDED_PREVIEW_TRIAL_SCORED_UNATTESTED',
  previewSha256ByArm:{...responses.previewSha256ByArm},
  caseCount:cases.cases.length,
  summary:rated.summary,paired:rated.paired,
  combinedVsPerCaseBestSingle:rated.combinedVsPerCaseBestSingle,
  results:rated.results,
  assessedBy:'DETERMINISTIC_LEXICAL_ORACLE_NOT_A_SEMANTIC_JUDGE',
  modelInvokedByScorer:false,
  hostOriginCryptographicallyVerified:false,
  hostSkillInstalledVerified:false,
  independentReviewAttested:false,
  sourceRightsApproved:false,
  causalQualityImprovementDemonstrated:false,
  productionEligible:false
 };
}
