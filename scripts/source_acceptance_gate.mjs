#!/usr/bin/env node
/**
 * Operator-pinned Ed25519 source-selection binding, before the P0 signed
 * four-fact assertion adapter. An external user cannot issue an approval
 * simply by presenting a passing source-inspection receipt.
 *
 * IMPORTANT: a source-binding signature authenticates an operator's scoped
 * decision; it is neither license truth nor the four independently asserted
 * Prism facts. The original P0 composer remains the final policy guest.
 *
 * The CLI only demonstrates default refusal; operator trust/signature inputs
 * must be injected by trusted backend code, not supplied on a request CLI.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';

export const SOURCE_ACCEPTANCE_SCHEMA='qortara/source-method-acceptance/1';
export const SOURCE_ACCEPTANCE_ENVELOPE='qortara/signed-source-method-acceptance/1';
export const SOURCE_TRUST_SCHEMA='qortara/source-method-acceptance-trust/1';
export const SOURCE_ACCEPTANCE_DOMAIN='QORTARA-SOURCE-METHOD-ACCEPTANCE-V1\n';
const HEX64=/^[0-9a-f]{64}$/;
const HEX40=/^[0-9a-f]{40}$/;
const IDENT=/^[a-zA-Z][a-zA-Z0-9_.:-]{2,159}$/;
const MAX_WINDOW=30*24*3600;

export class SourceAcceptanceRefusal extends Error{
  constructor(code,message){super(message);this.name='SourceAcceptanceRefusal';this.code=code;}
}
const reject=(code,msg)=>{throw new SourceAcceptanceRefusal(code,msg);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const sha=x=>createHash('sha256').update(x).digest('hex');
const sha64=x=>typeof x==='string'&&HEX64.test(x);
const sha40=x=>typeof x==='string'&&HEX40.test(x);
const label=x=>typeof x==='string'&&IDENT.test(x);
const epoch=x=>Number.isSafeInteger(x)&&x>=0&&x<=253402300799;
function exact(x,keys,code){
  if(!plain(x)||Object.keys(x).sort().join('|')!==[...keys].sort().join('|'))
    reject(code,'missing or unexpected fields');
}
function canonicalize(x){
  if(Array.isArray(x))return x.map(canonicalize);
  if(plain(x))return Object.fromEntries(Object.keys(x).sort().map(k=>{
    if(['__proto__','constructor','prototype'].includes(k))
      reject('SOURCE_CANONICAL','unsafe JSON property name');
    return [k,canonicalize(x[k])];
  }));
  if(typeof x==='string')return x;
  if(x===null||typeof x==='boolean'||(typeof x==='number'&&Number.isSafeInteger(x)))
    return x;
  reject('SOURCE_CANONICAL','unserializable canonical JSON value');
}
export const canonicalSourceJSON=x=>JSON.stringify(canonicalize(x))+'\n';

export function validateSourcePreflight(preflight,scope){
  exact(scope,['host','route','snapshotCommit','snapshotTree'],'SOURCE_SCOPE');
  if(typeof scope.host!=='string'||!scope.host||typeof scope.route!=='string'||!scope.route||
     !sha40(scope.snapshotCommit)||!sha40(scope.snapshotTree))
    reject('SOURCE_SCOPE','trusted operator source route, host and snapshot pins required');
  if(!plain(preflight)||preflight.schema!=='qortara/method-to-prism-preflight/1'||
     preflight.state!=='UNSIGNED_P0_DENIAL_VECTOR_NOT_READY_FOR_COMPOSITION'||
     preflight.negative_test_vector_hex!=='00000000'||
     preflight.source_package_bytes_verified!==true||
     preflight.source_byte_verification_not_semantic_review!==true||
     preflight.independently_authenticated_method_assertion!==false||
     preflight.operator_accepted_rights!==false||
     preflight.host_authority_verified!==false||
     preflight.composition_eligible!==false||
     preflight.prism_invoked!==false||
     preflight.prism_guest_decision!==null)
    reject('SOURCE_PREFLIGHT','source preflight cannot be promoted or lacks full byte evidence');
  exact(preflight.facts_verified,['evidence','rights','authority','coverage'],'SOURCE_PREFLIGHT');
  if(Object.values(preflight.facts_verified).some(x=>x!==false))
    reject('SOURCE_PREFLIGHT','preflight invented positive assurance facts');
  const b=preflight.binding;
  if(!plain(b)||!sha64(preflight.binding_sha256)||
     sha(canonicalSourceJSON(b))!==preflight.binding_sha256||
     b.snapshot_commit!==scope.snapshotCommit||b.snapshot_tree!==scope.snapshotTree||
     b.requested_route!==scope.route||b.requested_host_label_not_authority!==scope.host||
     !sha64(b.governed_record_sha256)||!sha64(b.package_inspection_sha256)||
     typeof b.governed_id!=='string'||!b.governed_id||
     b.package_bytes_verified!==true)
    reject('SOURCE_BINDING','source selection does not match exact operator-accepted scope');
  return Object.freeze({sourceBindingSha256:preflight.binding_sha256,
    snapshotCommit:b.snapshot_commit,snapshotTree:b.snapshot_tree,
    governedId:b.governed_id,route:b.requested_route,host:b.requested_host_label_not_authority,
    packageInspectionSha256:b.package_inspection_sha256});
}
function trusted(config,now){
  exact(config,['schema','issuer','keyId','policyRevision','publicKeyPem',
                'publicKeySha256','scope','revocations'],'SOURCE_TRUST');
  if(config.schema!==SOURCE_TRUST_SCHEMA||!label(config.issuer)||
     !label(config.keyId)||!label(config.policyRevision)||
     !sha64(config.publicKeySha256)||
     typeof config.publicKeyPem!=='string'||config.publicKeyPem.length>4096)
    reject('SOURCE_TRUST','invalid independently accepted operator signing key');
  const r=config.revocations;
  exact(r,['validFrom','expiresAt','revokedApprovalDigests'],'SOURCE_TRUST');
  if(!epoch(now)||!epoch(r.validFrom)||!epoch(r.expiresAt)||now<r.validFrom||
     now>r.expiresAt||r.validFrom>=r.expiresAt||
     !Array.isArray(r.revokedApprovalDigests)||r.revokedApprovalDigests.length>10000||
     r.revokedApprovalDigests.some(d=>!sha64(d))||
     new Set(r.revokedApprovalDigests).size!==r.revokedApprovalDigests.length)
    reject('SOURCE_REVOCATIONS','revocation evidence is stale, missing or malformed');
  let key;
  try{key=createPublicKey(config.publicKeyPem);}catch{
    reject('SOURCE_TRUST','invalid operator public key');
  }
  if(key.asymmetricKeyType!=='ed25519'||sha(key.export({type:'spki',format:'der'}))!==
     config.publicKeySha256)
    reject('SOURCE_TRUST','operator key fingerprint or algorithm differs');
  return {key,scope:config.scope,issuer:config.issuer,
    keyId:config.keyId,policyRevision:config.policyRevision,
    revocations:new Set(r.revokedApprovalDigests)};
}

export function verifySourceAcceptance({preflight,trust,envelope,subjectSha256,nowEpoch}={}){
  // No fake trust-bundle or signature fallback; nothing is authorized by default.
  if(!plain(trust)||!plain(envelope))
    reject('SOURCE_ACCEPTANCE_MISSING','independently pinned operator key and signed decision required');
  const clock=nowEpoch??(()=>Math.floor(Date.now()/1000));
  if(typeof clock!=='function')reject('SOURCE_CLOCK','operator epoch clock unavailable');
  const now=clock();
  const pinned=trusted(trust,now);
  const binding=validateSourcePreflight(preflight,pinned.scope);
  if(!sha64(subjectSha256))
    reject('SOURCE_SUBJECT','exact P0 composer assurance subject required');
  exact(envelope,['schema','payload','signature'],'SOURCE_SIGNATURE');
  if(envelope.schema!==SOURCE_ACCEPTANCE_ENVELOPE)
    reject('SOURCE_SIGNATURE','unknown source approval signature envelope');
  const p=envelope.payload;
  exact(p,['schema','issuer','keyId','policyRevision','sourceBindingSha256',
           'composerSubjectSha256','governedId','snapshotCommit','snapshotTree',
           'requestedHost','capabilityRoute','packageInspectionSha256',
           'validFrom','expiresAt'],'SOURCE_APPROVAL');
  if(p.schema!==SOURCE_ACCEPTANCE_SCHEMA||p.issuer!==pinned.issuer||
     p.keyId!==pinned.keyId||p.policyRevision!==pinned.policyRevision||
     p.sourceBindingSha256!==binding.sourceBindingSha256||
     p.composerSubjectSha256!==subjectSha256||p.governedId!==binding.governedId||
     p.snapshotCommit!==binding.snapshotCommit||p.snapshotTree!==binding.snapshotTree||
     p.requestedHost!==binding.host||p.capabilityRoute!==binding.route||
     p.packageInspectionSha256!==binding.packageInspectionSha256)
    reject('SOURCE_APPROVAL_SCOPE','signed selection, source, host or composer subject differs');
  if(!epoch(p.validFrom)||!epoch(p.expiresAt)||p.expiresAt<=p.validFrom||
     p.expiresAt-p.validFrom>MAX_WINDOW||now<p.validFrom||now>p.expiresAt)
    reject('SOURCE_APPROVAL_EXPIRED','operator acceptance expired or not yet valid');
  if(typeof envelope.signature!=='string'||
     !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))
    reject('SOURCE_SIGNATURE','invalid Ed25519 base64url encoding');
  const signature=Buffer.from(envelope.signature,'base64url');
  if(signature.length!==64||signature.toString('base64url')!==envelope.signature)
    reject('SOURCE_SIGNATURE','noncanonical signature bytes');
  const message=Buffer.from(SOURCE_ACCEPTANCE_DOMAIN+canonicalSourceJSON(p));
  if(!verifySignature(null,message,pinned.key,signature))
    reject('SOURCE_SIGNATURE','source approval signature does not verify');
  const proofDigest=sha(canonicalSourceJSON(envelope));
  if(pinned.revocations.has(proofDigest))
    reject('SOURCE_APPROVAL_REVOKED','source approval was revoked');
  return Object.freeze({
    schema:'qortara/source-method-approval-verification/1',
    state:'OPERATOR_SOURCE_BINDING_SIGNATURE_VALID',
    sourceBindingSha256:binding.sourceBindingSha256,
    composerSubjectSha256:subjectSha256,operatorIssuer:pinned.issuer,
    acceptanceProofSha256:proofDigest,
    signatureAuthenticatesOnlyIssuerClaim:true,
    independentMethodBehaviorValidated:false,
    legalRightsIndependentlyEstablishedByThisVerifier:false,
    hostBehaviorValidated:false,
    prismFourFactsVerified:false,
    prismInvoked:false,
    productionEligible:false,
    compositionEligible:false});
}

/**
 * Trusted coordinator calls this guard from the real PR #28 composer.
 * Its delegate MUST be the separately configured real signed four-fact
 * assertion verifier, never a caller-supplied function from a recipe body.
 */
export function createSourceBoundAssertionGuard({
  preflight,trust,readOperatorAcceptance,assertSignedMethod,nowEpoch
}={}){
  if(typeof readOperatorAcceptance!=='function'||typeof assertSignedMethod!=='function')
    reject('SOURCE_TRUST','operator-controlled acceptance resolver and signed-fact verifier required');
  // Validate and snapshot in constructor; object mutation after bootstrap
  // cannot replace accepted source bytes, host, or trusted pin claims.
  let stored,source;
  try{
    source=JSON.parse(canonicalSourceJSON(preflight));
    stored=JSON.parse(canonicalSourceJSON(trust));
  }catch{reject('SOURCE_TRUST','malformed source preflight or trusted configuration');}
  return async function boundAssertMethod({recipe,method,subjectSha256}={}){
    const envelope=await readOperatorAcceptance({subjectSha256,
      bindingSha256:source.binding_sha256});
    const accepted=verifySourceAcceptance({
      preflight:source,trust:stored,envelope,subjectSha256,nowEpoch});
    const result=await assertSignedMethod({recipe,method,subjectSha256});
    // The PR #28 composer still strictly checks its own signed method
    // facts and performs the actual pinned Prism guest call.
    if(!plain(result)||result.subjectSha256!==subjectSha256||
       !sha64(result.proofDigest)||typeof result.issuer!=='string'||
       ['evidence','rights','authority','coverage'].some(k=>typeof result[k]!=='boolean'))
      reject('SOURCE_FACT_ASSERTION','independent P0 fact adapter returned malformed evidence');
    return {...result,sourceAcceptanceProofSha256:accepted.acceptanceProofSha256};
  };
}

// Deliberately no CLI option for operator public keys/signatures. A request
// cannot bootstrap its own rights authority.
async function main(args){
  if(args.length!==2||args[0]!=='--preflight'||!isAbsolute(args[1]))
    reject('SOURCE_CLI','usage: --preflight ABSOLUTE_ORIGINAL_RECEIPT_JSON');
  const obj=JSON.parse(await readFile(args[1],'utf8'));
  if(!plain(obj))reject('SOURCE_PREFLIGHT','invalid preflight JSON');
  reject('SOURCE_ACCEPTANCE_MISSING',
         'source inspection is not operator signed approval; use trusted coordinator');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  main(process.argv.slice(2)).catch(err=>{
    console.error(JSON.stringify({state:'REFUSED',code:err?.code??'SOURCE_CLI',
      message:String(err?.message??err),compositionEligible:false,
      prismInvoked:false}));
    process.exitCode=2;
  });
}
