/** Fixed Prism SM-01 acceptance vectors for output comparison, never a decision engine. */
export const CASES=Object.freeze([
 {id:'eligible',hex:'01010101',expected:'eligible'},
 {id:'evidence',hex:'00010101',expected:'refused: EVIDENCE_UNQUALIFIED'},
 {id:'rights',hex:'01000101',expected:'refused: RIGHTS_UNRESOLVED'},
 {id:'prohibited-rights',hex:'01020101',expected:'refused: RIGHTS_UNRESOLVED'},
 {id:'authority',hex:'01010001',expected:'refused: AUTHORITY_EXCEEDED'},
 {id:'coverage',hex:'01010100',expected:'refused: OUTCOME_UNCOVERED'},
 {id:'all-refused',hex:'00000000',expected:'refused: EVIDENCE_UNQUALIFIED RIGHTS_UNRESOLVED AUTHORITY_EXCEEDED OUTCOME_UNCOVERED'},
 {id:'unknown-code',hex:'ff010101',expected:'refused: EVIDENCE_UNQUALIFIED'},
 {id:'short',hex:'010101',expected:'invalid request'},
 {id:'long',hex:'0101010101',expected:'invalid request'},
 {id:'empty',hex:'',expected:'invalid request'},
 {id:'allocation-boundary',hex:'00'.repeat(512),expected:'invalid request'}
]);
