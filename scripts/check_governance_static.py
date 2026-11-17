#!/usr/bin/env python3
"""Supplemental, read-only document-layout lint. NOT Qortara's canonical checks.

Native 'qortara check repository-documents', 'qortara check architecture-index',
and governed Shadow/ledger verification remain separately required.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REQUIRED = ("README.md", "ARCHITECTURE_INDEX.md", "docs/README.md", "GOVERNANCE.md", "SECURITY.md")
IGNORE = ("keys/", "session", "*.lock", "*.tmp", "hooks.jsonl")
LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
ARCH_OWNER_LINK = re.compile(r"\]\(architecture/([^)/#]+\.md)(?:#[^)]*)?\)")


def assess(root: Path) -> tuple[list[str], list[str]]:
    """Return (structural problems, qualification holds) without writing files."""
    errors: list[str] = []
    holds: list[str] = []
    root = root.resolve()
    texts: dict[str, str] = {}
    for rel in REQUIRED:
        path = root / rel
        if path.is_symlink() or not path.is_file():
            errors.append(f"required file missing, unreadable, or symlink: {rel}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            errors.append(f"required file not valid UTF-8: {rel}")
            continue
        if not text.strip():
            errors.append(f"required file is empty: {rel}")
            continue
        texts[rel] = text

    index = texts.get("ARCHITECTURE_INDEX.md", "")
    register = texts.get("docs/README.md", "")
    if index and len(re.findall(r"\]\(docs/README\.md(?:#[^)]*)?\)", index)) != 1:
        errors.append("root architecture entrypoint must link once to docs/README.md")

    owner_links = ARCH_OWNER_LINK.findall(register)
    owners = {name: owner_links.count(name) for name in owner_links}
    pages = sorted((root / "docs" / "architecture").glob("*.md"))
    if not pages:
        holds.append("no architecture owner pages; architecture coverage not established")
    for page in pages:
        if page.is_symlink() or not page.is_file():
            errors.append(f"architecture page not a regular file: {page.name}")
        if owners.get(page.name, 0) != 1:
            errors.append(f"architecture owner must be registered exactly once: {page.name}")
    for name in owners:
        if not (root / "docs" / "architecture" / name).is_file():
            errors.append(f"owner register references missing architecture page: {name}")

    for rel in ("README.md", "ARCHITECTURE_INDEX.md", "docs/README.md"):
        if rel not in texts:
            continue
        parent = (root / rel).parent
        readme_slugs = set()
        if rel == "README.md":
            headings = re.findall(r"^#{1,6}\s+(.+?)\s*$", texts[rel], re.MULTILINE)
            readme_slugs = {
                re.sub(r"-+", "-", re.sub(r"[^a-z0-9 -]", "", h.lower()).strip().replace(" ", "-"))
                for h in headings
            }
        for target in LINK.findall(texts[rel]):
            if target.startswith("#") and rel == "README.md":
                if target[1:] not in readme_slugs:
                    errors.append(f"broken README heading link: {target}")
                continue
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            filepart = target.split("#", 1)[0]
            if not filepart:
                continue
            path = (parent / filepart).resolve()
            if root not in path.parents and path != root:
                errors.append(f"link escapes repository: {rel} -> {target}")
            elif not path.exists():
                errors.append(f"broken local link: {rel} -> {target}")

    policy = texts.get("GOVERNANCE.md", "")
    if policy and not all(s in policy.lower() for s in ("owner", "approval", "exception")):
        errors.append("GOVERNANCE.md missing material owner/approval/exception sections")
    sec = texts.get("SECURITY.md", "")
    if sec and not all(s in sec.lower() for s in ("vulnerabil", "report", "version", "handling")):
        errors.append("SECURITY.md missing reporting/handling/supported-version scope")
    if sec and "NOT_ESTABLISHED" in sec:
        holds.append("SECURITY.md reporting and support policy has unqualified owner input")

    ignore = root / ".qortara" / ".gitignore"
    if not ignore.is_file() or ignore.is_symlink():
        errors.append("missing Qortara-local .gitignore")
    else:
        try:
            lines = set(ignore.read_text(encoding="utf-8").splitlines())
            for entry in IGNORE:
                if entry not in lines:
                    errors.append(f"Qortara-local ignore entry missing: {entry}")
        except (OSError, UnicodeError):
            errors.append("Qortara-local .gitignore unreadable")
    shadow = root / ".qortara" / "shadow.jsonl"
    if shadow.exists() or shadow.is_symlink():
        if shadow.is_symlink() or not shadow.is_file():
            errors.append("shadow log is not a regular file")
        else:
            try:
                with shadow.open(encoding="utf-8") as lines:
                    seen = set()
                    for number, line in enumerate(lines, start=1):
                        if not line.strip():
                            continue
                        obj = json.loads(line)
                        if not isinstance(obj, dict):
                            errors.append(f"shadow line {number} is not an object")
                        if isinstance(obj, dict) and "id" in obj:
                            if obj["id"] in seen:
                                errors.append(f"shadow duplicate event id on line {number}")
                            seen.add(obj["id"])
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                errors.append(f"shadow log parsing failure: {type(exc).__name__}")
    return errors, holds


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    errors, holds = assess(args.root)
    for message in errors:
        print("STATIC_ERROR:", message)
    for message in holds:
        print("QUALIFICATION_HOLD:", message)
    if errors or holds:
        print("NOT_QUALIFIED: static check cannot replace native Qortara validation")
        return 1
    print("STATIC_LAYOUT_PASS ONLY: native Qortara checks, owner approval and host evidence still required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
