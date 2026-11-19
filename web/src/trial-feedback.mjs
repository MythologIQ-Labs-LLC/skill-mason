/**
 * Human-selected, categorical feedback for the public STARTER draft preview.
 * No request text, generated skill text, model transcript, browser fingerprint,
 * cookies, network calls, or user-provided free text are ever collected here.
 * This export is local only. It is NOT independently observed host evidence.
 */
export const FEEDBACK_SCHEMA='qortara/public-starter-feedback/1';
export const HOSTS=Object.freeze(['browser-only','chatgpt','claude','codex','other']);
export const OUTCOMES=Object.freeze([
 'not-tested-in-host','useful-as-is','useful-with-edits','not-useful','host-refused'
]);
export const GAPS=Object.freeze([
 'not-rated','too-generic','wrong-or-missing-steps','unsupported-host','safety-concern','other'
]);
export function buildFeedbackReport({host,outcome,gap}={}){
 if(!HOSTS.includes(host)||!OUTCOMES.includes(outcome)||!GAPS.includes(gap))
  throw new TypeError('Choose valid trial feedback options.');
 return Object.freeze({
  schema:FEEDBACK_SCHEMA,
  trial:'browser-starter-template-only',
  generation:'qortara-starter-template-v1',
  declaredHost:host,
  reportedOutcome:outcome,
  reportedLargestGap:gap,
  evidenceClass:'SELF_REPORTED_NOT_INDEPENDENTLY_VERIFIED',
  hasRequestText:false,
  hasGeneratedSkillText:false,
  hasModelTranscript:false,
  uploadedBySite:false
 });
}
