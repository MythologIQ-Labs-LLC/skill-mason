Feature: eligibility

  Skill Mason's first Prism application, in eligibility/: given four coded
  facts about one pinned source method (its evidence state, its reuse rights,
  the authority it needs and whether it covers the requested outcome), it
  answers whether the method is eligible, and names every fact that refuses it.

  @SM-01 @build
  Scenario: The decision answers eligible exactly when the evidence, rights, authority and coverage codes are each the single admitted code
    Given the eligibility model in eligibility/src/Eligibility.lex.tex
    When the Lean kernel checks eligible_decides during prismpm verify
    Then eligible is true exactly when each of the four codes is the single admitted code
    And the response the application returns is decided by that same eligible
