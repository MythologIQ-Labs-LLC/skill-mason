//! The `eligibility` suite: one test per scenario in `features/suites/eligibility.feature`.
//!
//! The proof is checked by the Lean kernel when `just vv` runs `prismpm verify`
//! on `eligibility/`. What this test holds fixed is the claim that proof is
//! about: the theorem's exact statement and axioms, the four facts it
//! quantifies over, the single admitted code, and that the response the
//! application returns is decided by the function it proves. A weakened
//! statement, a dropped fact, a second admitted code, an extra axiom, or a
//! response decided some other way would still verify, and would no longer be
//! the claim `SM-01` makes.

use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .expect("crates/conformance is two below the root")
        .to_path_buf()
}

/// The declaration named `name`, in either layout the formatter writes.
fn declaration<'a>(model: &'a str, name: &str) -> &'a str {
    let one_line = format!("{{name: {name}, ");
    if let Some(start) = model.find(&one_line) {
        let end = model[start..]
            .find('\n')
            .expect("a declaration ends its line");
        return &model[start..start + end];
    }
    let start = model
        .find(&format!("\n  name: {name},\n"))
        .unwrap_or_else(|| panic!("{name} is not declared"));
    let end = model[start..]
        .find("\n}\n")
        .unwrap_or_else(|| panic!("{name} is not closed"));
    &model[start..start + end]
}

/// `SM-01`: The decision answers eligible exactly when the evidence, rights, authority and coverage codes are each the single admitted code
#[test]
fn eligibility_sm_01() {
    let model = std::fs::read_to_string(root().join("eligibility/src/Eligibility.lex.tex"))
        .expect("the eligibility model");

    let decides = declaration(&model, "eligible_decides");
    assert!(
        decides.contains("statement: (((eligible request) = true) <-> (Eligible request)),"),
        "SM-01's statement changed: eligible must be true exactly when Eligible holds:\n{decides}"
    );
    assert!(
        decides.contains("parameters: [request : Request],")
            && decides.contains("axioms: [propext]"),
        "SM-01 quantifies over every request and rests on propext only:\n{decides}"
    );

    // One code is admitted. Every other code, defined or not, refuses.
    let admitted = declaration(&model, "admitted");
    assert!(
        admitted.contains("parameters: [code : Nat], result: Bool, body: (code =? 1)}"),
        "exactly one code may be admitted:\n{admitted}"
    );

    // The proposition and the function both name all four facts, and the
    // refusal names each fact that failed.
    let proposition = declaration(&model, "Eligible");
    let function = declaration(&model, "eligible");
    let refusals = declaration(&model, "refusals");
    let facts = [
        ("evidence", "EVIDENCE_UNQUALIFIED"),
        ("rights", "RIGHTS_UNRESOLVED"),
        ("authority", "AUTHORITY_EXCEEDED"),
        ("coverage", "OUTCOME_UNCOVERED"),
    ];
    for (fact, reason) in facts {
        assert!(
            proposition.contains(&format!("((project request {fact}) = 1)")),
            "Eligible must require the admitted {fact} code"
        );
        assert!(
            function.contains(&format!("(admitted (project request {fact}))")),
            "eligible must check {fact}"
        );
        assert!(
            refusals.contains(&format!(
                "(refusalEntry (project request {fact}) (prim utf8_encode \" {reason}\" : Bytes))"
            )),
            "a refused {fact} must be named {reason} in the response"
        );
    }

    // A request is exactly four bytes, anything else is invalid, and the
    // response is decided by `eligible`, the function SM-01 proves.
    let dispatch = declaration(&model, "dispatch");
    assert!(
        dispatch.contains("(if ((Foundation.Bytes::byteLength value) =? 4) then")
            && dispatch.contains("else (prim utf8_encode \"invalid request\" : Bytes))"),
        "a request of any other length must be invalid, never eligible:\n{dispatch}"
    );
    assert!(
        dispatch.contains(
            "(if (eligible (observe value)) then (prim utf8_encode \"eligible\" : Bytes) else"
        ),
        "the response must be decided by eligible, the function SM-01 proves"
    );
}
