/**
 * Browser-only SM-01 Prism artifact inspection and execution.
 * No eligibility decision is implemented here. Only the loaded .holo decides.
 */
export const APP_NAME='Qortara Skills Eligibility';
export const MAX_HOLO_BYTES=64*1024*1024;
export const MAX_REQUEST_BYTES=512;
export class WebError extends Error {
 constructor(code,message){super(message);this.name='WebError';this.code=code;}
}
const SHA=/^[0-9a-f]{64}$/;
export function normalizeSha(s){
 if(typeof s!=='string'||!SHA.test(s))throw new WebError('SHA_REQUIRED','Enter the lowercase SHA-256 from the independent native build receipt.');
 return s;
}
export function decodeHex(hex){
 if(typeof hex!=='string'||!/^(?:[0-9a-fA-F]{2})*$/.test(hex)||hex.length>MAX_REQUEST_BYTES*2)
   throw new WebError('INPUT_INVALID','Hex input must be even-length and no larger than 512 bytes.');
 const bytes=new Uint8Array(hex.length/2);
 for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
 return bytes;
}
export function hexOf(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function utf8Of(bytes){
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch {throw new WebError('OUTPUT_UTF8','The Prism guest returned invalid UTF-8.');}
}
export async function sha256(bytes,cryptoImpl=globalThis.crypto){
 if(!cryptoImpl?.subtle?.digest)throw new WebError('CRYPTO_UNAVAILABLE','Browser Web Crypto SHA-256 unavailable.');
 return hexOf(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes)));
}
/**
 * A *supplied* recorded digest is required. Computing one from the file is
 * not the same as verifying provenance, proof level, source rights, or author.
 */
export async function openHolo(file,expected,load,cryptoImpl=globalThis.crypto){
 normalizeSha(expected);
 if(!file || !String(file.name??'').endsWith('.holo'))
   throw new WebError('HOLO_REQUIRED','Choose a .holo file built under the accepted native gate.');
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_HOLO_BYTES)
   throw new WebError('HOLO_SIZE','Invalid holo size or larger than the 64 MiB browser limit.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.byteLength!==file.size)throw new WebError('HOLO_CHANGED','Read size changed while loading.');
 const actual=await sha256(bytes,cryptoImpl);
 if(actual!==expected)throw new WebError('DIGEST_MISMATCH','The selected holo does not match the independently recorded SHA-256.');
 if(typeof load!=='function')throw new WebError('SDK_UNAVAILABLE','The local pinned Prism browser SDK bundle is unavailable.');
 let app;
 try{app=await load(bytes);}
 catch(err){throw new WebError('HOLO_LOAD_REFUSED',String(err?.code??err?.message??'Prism load error'));}
 if(app?.name!==APP_NAME)
   throw new WebError('WRONG_APP','This is not the final named Qortara Skills Eligibility holo.');
 if(typeof app.experimental_verify!=='function'||typeof app.dispatch!=='function')
   throw new WebError('SDK_INTERFACE','Pinned Prism application verification/dispatch API is missing.');
 let verdict;
 try{verdict=await app.experimental_verify({minimum:'P0',effects:[]});}
 catch(err){throw new WebError('VERIFY_FAILED',String(err?.code??err?.message??'Prism verification failed'));}
 if(verdict?.passed!==true)
   throw new WebError('VERIFY_REFUSED','Prism rejected the archive under the P0 pure-world fixture policy.');
 return {app,identity:{name:app.name,sha256:actual,bytes:bytes.length,assurance:verdict.level,
     policyMinimum:'P0',productionEligible:false},verdict};
}
export async function runGuest(session,hex){
 if(!session?.app?.dispatch)throw new WebError('NOT_READY','Verify a real holo before evaluating.');
 const request=decodeHex(hex);
 let output;
 try{output=await session.app.dispatch(request);}
 catch(err){throw new WebError('PRISM_REFUSAL',String(err?.code??err?.message??'Prism guest refused'));}
 if(!(output instanceof Uint8Array))
   throw new WebError('OUTPUT_INVALID','Prism did not return bytes.');
 return {requestHex:hexOf(request),response:utf8Of(output),responseHex:hexOf(output),
   assurance:session.identity.assurance,productionEligible:false};
}
export async function runFixtures(session,fixtures){
 const tests=[];
 for(const c of fixtures){
   try{
    const result=await runGuest(session,c.hex);
    tests.push({id:c.id,expected:c.expected,actual:result.response,
      pass:result.response===c.expected,requestHex:c.hex});
   }catch(err){tests.push({id:c.id,expected:c.expected,actual:null,pass:false,error:err.code??'PRISM_ERROR'});}
 }
 return {schema:'qortara/skills-pages-sm01/1',source:'real Prism guest, no local eligibility fallback',
   artifact:session.identity,tests,passed:tests.filter(t=>t.pass).length,total:tests.length,
   verdict:tests.every(t=>t.pass)?'FIXTURE_PASS':'FIXTURE_FAIL',productionEligible:false};
}
