/**
 * Development-only bridge from the deterministic composer to the actual
 * local Prism CLI consumer. No decision logic or JS admission fallback.
 *
 * The holo path, independent SHA-256 pin and pinned Prism runtime originate
 * from operator bootstrap, not from the user's skill request.
 */
import {isAbsolute} from 'node:path';
import {evaluate,loadPinnedRuntime} from '../../bin/qortara-skills.mjs';

const SHA=/^[0-9a-f]{64}$/;
const FOUR_FACTS=/^(?:00|01){4}$/;

export class PrismGuestRefusal extends Error {
  constructor(code,message){super(message);this.name='PrismGuestRefusal';this.code=code;}
}
function fail(code,message){throw new PrismGuestRefusal(code,message);}
function shape(x) {
  return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
    Object.getPrototypeOf(x)===Object.prototype;
}

/**
 * The explicit consent flag restricts the entire adapter to P0 fixture use.
 * A future trusted production adapter must be an independently reviewed
 * implementation, not this API with a looser policy.
 */
export function createPinnedPrismGuest({holoPath,holoSha256,developmentP0Consent,loadRuntime}={}){
  if(developmentP0Consent!==true)
    fail('ASSURANCE_HOLD','explicit development-only P0 consent required');
  if(typeof holoPath!=='string'||holoPath.length>2048||!isAbsolute(holoPath)||
     !holoPath.endsWith('.holo')||holoPath.includes('\0')||
     typeof holoSha256!=='string'||!SHA.test(holoSha256))
    fail('PRISM_CONFIG','absolute holo path and exact lowercase SHA-256 pin required');
  if(loadRuntime!==undefined&&typeof loadRuntime!=='function')
    fail('PRISM_CONFIG','runtime provider must be an internal function');
  const runtime=loadRuntime??loadPinnedRuntime;
  return async function runPrism(args){
    // The backend has only one permitted guest request shape. The source
    // method, caller, and browser cannot smuggle a different runtime policy.
    if(!shape(args)||Object.keys(args).sort().join('|')!=='holoSha256|requestHex')
      fail('PRISM_INPUT','expected bounded four-fact Prism invocation');
    if(args.holoSha256!==holoSha256)
      fail('PRISM_PIN','caller and configured holo identities disagree');
    if(typeof args.requestHex!=='string'||!FOUR_FACTS.test(args.requestHex))
      fail('PRISM_INPUT','SM-01 requires four explicit admitted/denied bytes');
    let result;
    try {
      // evaluate() independently hashes the regular non-symlink holo before
      // loading the exact Prism runtime, and invokes containers.run with
      // minimum P0, effects [], rm true, WITHOUT allowUnverified.
      result=await evaluate({'--holo':holoPath,'--sha256':holoSha256,
        '--hex':args.requestHex},runtime);
    }catch(err){
      fail('PRISM_UNAVAILABLE','real pinned Prism artifact/runtime unavailable: '+(err?.code??'RUNTIME_ERROR'));
    }
    if(!shape(result)||result.schema!=='qortara/local-eligibility-result/1'||
       result.engine!=='prism-code@0.9.5'||result.application!=='Qortara Skills Eligibility'||
       result.requestHex!==args.requestHex||result.artifact?.sha256!==holoSha256||
       result.productionEligible!==false)
      fail('PRISM_RESPONSE','real Prism consumer returned an unbound response');
    // Return the real consumer result exactly, including failure status.
    // The composer evaluates guest admission/refusal and will fail closed.
    return result;
  };
}
