/**
 * Offline signature and bytes verifier for assertions used by Skill Mason.
 *
 * It verifies WHO signed the four booleans and WHICH exact evidence bytes the
 * signed record names. It does not determine whether a license actually
 * permits reuse, whether the evidence is semantically true, or whether a host
 * skill works. Only operator-pinned keys and policy may be configured here.
 *
 * DEVELOPMENT ONLY: trust-root approval and real evidence custody are pending.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonicalJSON} from './compose.mjs';

export const SIGNED_ASSERTION_SCHEMA='qortara/signed-method-assertion/1';
export const ASSERTION_SCHEMA='qortara/method-assertion/1';
export const TRUST_SCHEMA='qortara/method-assertion-trust/1';
const DOMAIN='QORTARA-METHOD-ASSERTION-V1\n';
const HEX=/^[0-9a-f]{64}$/;
const LABEL=/^[a-zA-Z][a-zA-Z0-9_.:-]{2,159}$/;
const FACTS=['authority','coverage','evidence','rights'];
const DAY=86400;
const MAX_VALIDITY=30*DAY;
const MAX_EVIDENCE=1_000_000;

export class AssertionRefusal extends Error{
  constructor(code,message){super(message);this.name='AssertionRefusal';this.code=code;}
}
function fail(code,message){throw new AssertionRefusal(code,message);}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function keys(x,allowed,code){
  if(!plain(x)||Object.keys(x).sort().join('|')!==[...allowed].sort().join('|'))
    fail(code,'unexpected or absent fields');
}
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
function validHash(x){return typeof x==='string'&&HEX.test(x);}
function validLabel(x){return typeof x==='string'&&LABEL.test(x);}
function epoch(x){return Number.isSafeInteger(x)&&x>=0&&x<=253402300799;}
function base64urlSignature(value){
  if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{86}$/.test(value))
    fail('BAD_SIGNATURE','noncanonical Ed25519 signature encoding');
  const bytes=Buffer.from(value,'base64url');
  if(bytes.length!==64||bytes.toString('base64url')!==value)
    fail('BAD_SIGNATURE','invalid signature bytes');
  return bytes;
}
function trustBundle(input){
  keys(input,['schema','issuer','keyId','publicKeyPem','publicKeySha256','policyRevision','revocations'],'TRUST_CONFIG');
  if(input.schema!==TRUST_SCHEMA||!validLabel(input.issuer)||!validLabel(input.keyId)||
     !validLabel(input.policyRevision)||!validHash(input.publicKeySha256)||
     typeof input.publicKeyPem!=='string'||input.publicKeyPem.length>4096)
    fail('TRUST_CONFIG','invalid pinned trust identity or policy revision');
  keys(input.revocations,['validFrom','expiresAt','proofDigests'],'TRUST_CONFIG');
  const r=input.revocations;
  if(!epoch(r.validFrom)||!epoch(r.expiresAt)||r.expiresAt<=r.validFrom||
     !Array.isArray(r.proofDigests)||r.proofDigests.length>10000||
     r.proofDigests.some(x=>!validHash(x))||
     new Set(r.proofDigests).size!==r.proofDigests.length)
    fail('TRUST_CONFIG','invalid revocation policy');
  let publicKey;
  try{publicKey=createPublicKey(input.publicKeyPem);}
  catch{fail('TRUST_CONFIG','invalid trusted public key');}
  if(publicKey.asymmetricKeyType!=='ed25519')
    fail('TRUST_CONFIG','trust root must use Ed25519');
  const fingerprint=hash(publicKey.export({type:'spki',format:'der'}));
  if(fingerprint!==input.publicKeySha256)
    fail('TRUST_CONFIG','trusted key fingerprint is not pinned');
  return {issuer:input.issuer,keyId:input.keyId,
    policyRevision:input.policyRevision,publicKey,revocations:{
      validFrom:r.validFrom,expiresAt:r.expiresAt,
      proofDigests:new Set(r.proofDigests)}};
}
function validatePayload(payload,trust,subjectSha256,now){
  keys(payload,['schema','subjectSha256','issuer','keyId','policyRevision',
                'validFrom','expiresAt','facts','evidenceDigests'],'BAD_ASSERTION');
  if(payload.schema!==ASSERTION_SCHEMA||payload.subjectSha256!==subjectSha256||
     payload.issuer!==trust.issuer||payload.keyId!==trust.keyId||
     payload.policyRevision!==trust.policyRevision)
    fail('ASSERTION_SCOPE','signed subject, issuer or policy does not match');
  if(!epoch(payload.validFrom)||!epoch(payload.expiresAt)||
     payload.expiresAt<=payload.validFrom||
     payload.expiresAt-payload.validFrom>MAX_VALIDITY||
     now<payload.validFrom||now>payload.expiresAt)
    fail('ASSERTION_EXPIRED','assertion not currently valid');
  keys(payload.facts,FACTS,'BAD_ASSERTION');
  keys(payload.evidenceDigests,FACTS,'BAD_ASSERTION');
  for(const field of FACTS){
    const flag=payload.facts[field],digest=payload.evidenceDigests[field];
    if(typeof flag!=='boolean'||(flag&&!validHash(digest))||(!flag&&digest!==null))
      fail('BAD_ASSERTION','missing, malformed or contradictory '+field+' evidence');
  }
}
function toEvidenceBytes(input){
  if(!Buffer.isBuffer(input)&&!(input instanceof Uint8Array))
    fail('EVIDENCE_MISSING','trusted evidence resolver returned no byte sequence');
  if(input.byteLength===0||input.byteLength>MAX_EVIDENCE)
    fail('EVIDENCE_MISSING','unbounded or empty evidence bytes');
  return Buffer.from(input);
}
/**
 * Caller MUST bootstrap trust, revocation state, evidence resolver and claim
 * loader from an operator-controlled source, never from an HTTP/user payload.
 *
 * Return value is the exact composer assertMethod adapter contract. A signed
 * positive fact authenticates the issuer's *claim*, not the underlying legal
 * or empirical truth. Production authorization remains a separate HOLD.
 */
export function createSignedAssertionAdapter({trust,loadEnvelope,readEvidence,nowEpoch}={}){
  if(typeof loadEnvelope!=='function'||typeof readEvidence!=='function')
    fail('TRUST_CONFIG','trusted claim and evidence resolvers are required');
  const pinned=trustBundle(trust);
  const clock=nowEpoch??(()=>Math.floor(Date.now()/1000));
  if(typeof clock!=='function')fail('TRUST_CONFIG','clock must be callable');
  return async function assertMethod({subjectSha256}={}){
    if(!validHash(subjectSha256))fail('ASSERTION_SCOPE','exact composition subject required');
    const now=clock();
    if(!epoch(now)||now<pinned.revocations.validFrom||
       now>pinned.revocations.expiresAt)
      fail('REVOCATIONS_STALE','revocation policy is not current');
    const envelope=await loadEnvelope(subjectSha256);
    keys(envelope,['schema','payload','signature'],'BAD_ASSERTION');
    if(envelope.schema!==SIGNED_ASSERTION_SCHEMA)
      fail('BAD_ASSERTION','unsupported assertion envelope version');
    const payload=envelope.payload;
    validatePayload(payload,pinned,subjectSha256,now);
    const sig=base64urlSignature(envelope.signature);
    const signedBytes=Buffer.from(DOMAIN+canonicalJSON(payload),'utf8');
    if(!verifySignature(null,signedBytes,pinned.publicKey,sig))
      fail('BAD_SIGNATURE','assertion signature did not verify');
    const proofDigest=hash(Buffer.from(canonicalJSON(envelope),'utf8'));
    if(pinned.revocations.proofDigests.has(proofDigest))
      fail('ASSERTION_REVOKED','signed proof digest is revoked');
    for(const field of FACTS){
      if(!payload.facts[field])continue;
      // The resolver is independently configured; the envelope cannot supply
      // unverified local paths, shell commands, URLs or object-storage keys.
      const blob=toEvidenceBytes(await readEvidence({sha256:payload.evidenceDigests[field],field}));
      if(hash(blob)!==payload.evidenceDigests[field])
        fail('EVIDENCE_MISMATCH','evidence bytes do not match signed '+field+' digest');
    }
    return {issuer:pinned.issuer,subjectSha256,proofDigest,
      evidence:payload.facts.evidence,rights:payload.facts.rights,
      authority:payload.facts.authority,coverage:payload.facts.coverage};
  };
}
