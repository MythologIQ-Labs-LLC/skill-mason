# Qortara Skills Security Policy

**Status:** Owner-selected security-reporting and handling policy for the public
pre-alpha `skill-mason` repository. The repository owner confirmed the choices
below on 2026-11-17 (America/New_York), and reported enabling GitHub Private
Vulnerability Reporting. This records an owner decision, **not independent
verification of a GitHub setting or a completed native Qortara audit**.

## Supported versions and scope

Qortara Skills is a public repository in **pre-alpha development**. No
production service, released generator, or supported version range is currently
promised. Security fixes are evaluated by the accountable owner against the
affected commit/revision and relevant maintained development branch.
Historical revisions are not automatically security-supported.

## Reporting vulnerabilities

Report suspected vulnerabilities **privately through GitHub Private
Vulnerability Reporting** for this repository:

[Privately report a vulnerability](https://github.com/MythologIQ-Labs-LLC/skill-mason/security/advisories/new)

The owner confirmed that the repository's private vulnerability reporting
setting has been enabled. This is the chosen reporting channel, not a
general-purpose issue, pull request, discussion or public bug report.

Do not post exploit details, credentials, unreleased code, security reports or
other confidential data publicly. Provide the affected revision/component,
impact and minimal reproduction steps without unnecessary sensitive data.
Do not send Qortara Skills reports to `security@qortara.com`, which belongs
to a different product/security scope.

If the private report form is unexpectedly unavailable, do **not** disclose
the vulnerability publicly as a workaround. The reporting-channel availability
must be corrected by the repository owner before a confidential submission
can proceed. No fallback mailbox or private channel is claimed.

## Response, accountability and handling

**Accountable authority:** the MythologIQ Labs, LLC project owner, or a
delegate explicitly authorized for the relevant security case. The owner
reviews reports privately, triages reproducibility and severity, assesses
affected revisions and dependency exposure, authorizes containment and
remediation, and decides on disclosure after an appropriate review.
Security-sensitive code changes follow the actual repository gates and
permissions. A report or proposed fix is not automatically accepted.

**Response and remediation timelines:** no guaranteed acknowledgment,
resolution or disclosure service-level agreement is offered during pre-alpha.
This is an explicit current policy decision, not a promised deadline or
an assertion that every past version receives backports.

## Contribution and disclosure boundary

The owner has selected **closed contributions during pre-alpha**, despite the
repository's public visibility. Public visibility does not imply permission
to submit or merge unsolicited code or to reuse source beyond the applicable
license. Changes by explicitly authorized maintainers and agents remain subject
to repository permissions, governed review and owner acceptance.

Security disclosures, release support promises, and any change to the
contribution model require a new explicit owner decision and policy update.
A public repository or a successful CI status is not evidence of publication
authorization, product fitness or security qualification.

See [GOVERNANCE.md](GOVERNANCE.md),
[ARCHITECTURE_INDEX.md](ARCHITECTURE_INDEX.md), and
[governed evidence layout](docs/technical/governed-evidence.md).
The current hosted Qortara Logic Demo can evaluate supplied governance
inputs, but cannot attest local file checks, owner identity or host execution.
