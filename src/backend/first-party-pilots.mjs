/**
 * Immutable original procedure bytes for a development-only P0 pilot.
 * This register is NOT a license, ownership certificate or rights grant.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalJSON} from './compose.mjs';
import {parseTextProcedure,PROCEDURE_VERSION} from './text-procedure.mjs';

export const PILOT_SOURCE_COMMIT='87a6a5965a25af95a50127f26ec5afb404e0f2b8';
// Each immutable method retains its own historical source commit; the snapshot includes v3.
export const PILOT_V2_SOURCE_COMMIT='ef8bd8046df65ca2a7419a7191f8f2e959d53156';
export const PILOT_SNAPSHOT_COMMIT='31e2c4b2c74632fea690a02910c69f06087ffc13';
export const PILOT_V4_SOURCE_COMMIT='7627d98f081f1335a1c0246e71300416e4b754c5';
export const PILOT_CURRENT_SNAPSHOT_COMMIT=PILOT_V4_SOURCE_COMMIT;
export const PILOT_SOURCE_REPOSITORY='https://github.com/MythologIQ-Labs-LLC/skill-mason';
export const PILOT_HOST='agent-skills-text-only-fixture';

export const PILOT_DEFINITIONS=Object.freeze([
  Object.freeze({id:'ci-failure-triage',title:'CI failure triage',
    description:'Analyze supplied CI failure logs and produce a grounded diagnosis without executing commands.',
    outcome:'triage CI failure',
    path:'pilots/first-party/ci-failure-triage/procedure.json',
    gitBlob:'23bd3a94a3da68996f406892dcbb94be247a6db9',
    sha256:'9821237913b05e0baea2e85994191dee1d4b794e9e1160348fdafd6dfe04bd47'}),
  Object.freeze({id:'ci-failure-triage-v2',title:'CI failure triage v2',
    description:'Diagnose multi-job and ambiguous CI failures with untrusted-log boundaries and discriminating verifications.',
    outcome:'triage complex CI failures',
    path:'pilots/first-party/ci-failure-triage-v2/procedure.json',
    sourceCommit:PILOT_V2_SOURCE_COMMIT,
    gitBlob:'fa036a2fa7ffc2e95e2bb79523321e583d65f045',
    sha256:'0b3350725eee7c5ef8c6d7bff5db7538ba546a8597c35c601499c85434cbe2c1'}),
  Object.freeze({id:'ci-failure-triage-v3',title:'CI failure triage v3',
    description:'Evidence-grounded CI triage with safe redaction of credentials and personal identifiers in logs.',
    outcome:'triage sensitive CI failure logs',
    path:'pilots/first-party/ci-failure-triage-v3/procedure.json',
    sourceCommit:PILOT_SNAPSHOT_COMMIT,
    gitBlob:'020d6850472c9f3fad80c07a1b6d2a5af78c34c4',
    sha256:'fcc156c7ac3c369716ab0fa957159996ae25d193b22c7805790fb100ee5669d5'}),
  Object.freeze({id:'ci-failure-triage-v4',title:'CI failure triage v4',
    description:'Trace exact CI revision provenance and distinguish competing failure causes while preserving privacy.',
    outcome:'triage provenance-sensitive CI failure logs',
    path:'pilots/first-party/ci-failure-triage-v4/procedure.json',
    sourceCommit:PILOT_V4_SOURCE_COMMIT,
    gitBlob:'d4669d434bc00aa07ca6d06be140ad661b8ac7dc',
    sha256:'2aae2a88a499cf7d65f70d03e619f25ca8e790f07481c3b2eb05ed563faaf761'}),
  Object.freeze({id:'governance-drift-review',title:'Governance drift review',
    description:'Compare supplied canonical requirements against observed implementation evidence without changing policy.',
    outcome:'review governance drift',
    path:'pilots/first-party/governance-drift-review/procedure.json',
    gitBlob:'0d18cb3c2a5a08ad64f395ce3adf48eec88a0c07',
    sha256:'949abaa21513610ce2d9b4a1b64da75af6edb4b9cea73266979eda85aec043d1'})
]);
const sha=(data)=>createHash('sha256').update(data).digest('hex');
const gitBlob=(data)=>createHash('sha1')
  .update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
function refuse(code,message){throw Object.assign(new Error(message),{code});}

/**
 * Source root is deliberately fixed to the module's own repository package,
 * not an arbitrary caller-controlled directory. Branch mutations are checked
 * against recorded original Git object identities.
 */
export async function loadFirstPartyPilots(){
  const sources=[];
  for(const pilot of PILOT_DEFINITIONS){
    const path=new URL('../../'+pilot.path,import.meta.url);
    const bytes=await readFile(path);
    if(bytes.length===0||bytes.length>16_000||gitBlob(bytes)!==pilot.gitBlob||sha(bytes)!==pilot.sha256)
      refuse('PILOT_SOURCE_DRIFT','first-party pilot source Git blob changed: '+pilot.id);
    const methodText=bytes.toString('utf8');
    if(Buffer.from(methodText,'utf8').compare(bytes)!==0)
      refuse('PILOT_SOURCE_DRIFT','pilot bytes are not exact UTF-8: '+pilot.id);
    parseTextProcedure(methodText);
    sources.push({
      method_id:pilot.id,package_id:'qortara-first-party/'+pilot.id,
      package_sha256:sha(bytes),packageBytes:Buffer.from(bytes),
      method:{
        id:pilot.id,origin:PILOT_SOURCE_REPOSITORY,sourcePath:pilot.path,
        commit:pilot.sourceCommit??PILOT_SOURCE_COMMIT,
        sha256:sha(bytes),methodVersion:PROCEDURE_VERSION,
        methodText,covers:[pilot.outcome],containsAssets:false
      }
    });
  }
  const pins=sources.map(entry=>({
    id:entry.method_id,path:entry.method.sourcePath,
    commit:entry.method.commit,gitBlob:PILOT_DEFINITIONS.find(x=>x.id===entry.method_id).gitBlob,
    sha256:entry.package_sha256
  })).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const sourceSnapshot=Object.freeze({repository:PILOT_SOURCE_REPOSITORY,
    commit:PILOT_CURRENT_SNAPSHOT_COMMIT,sha256:sha(Buffer.from(canonicalJSON(pins)))});
  return Object.freeze({sourceSnapshot,
    supportedHosts:Object.freeze([PILOT_HOST]),
    components:Object.freeze(sources)});
}
export function recipeForPilot(pilotId,registry){
  const chosen=PILOT_DEFINITIONS.find(x=>x.id===pilotId);
  if(!chosen)refuse('PILOT_UNKNOWN','unknown first-party pilot');
  const source=registry.components.find(x=>x.method_id===pilotId);
  if(!source)refuse('PILOT_SOURCE_DRIFT','pilot source registry is incomplete');
  return {
    schema_version:'skill-mason.recipe.v0',skill_id:chosen.id,
    title:chosen.title,description:chosen.description,
    target_host:PILOT_HOST,required_outcomes:[chosen.outcome],
    source_snapshot:{...registry.sourceSnapshot},
    components:[{method_id:source.method_id,package_id:source.package_id,
      package_sha256:source.package_sha256}],
    authority:{network:false,secrets:false,execution:false}
  };
}
