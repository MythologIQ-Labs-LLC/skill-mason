#!/usr/bin/env python3
"""Pinned, read-only skillz handoff inspection. NEVER approves composition."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import stat
import sys

ORIGIN = "https://github.com/Knapp-Kevin/skillz"
COMMIT = "31a8c518dd97b7828adcc728202fa41388a306d7"
TREE = "e6d5dfeb42bcd7777ddff52605922fead62135ff"
MANIFEST_BLOB = "55974d44fdfde36bd537a552feac933c341e1895"


class Refusal(ValueError):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code


def require(ok, code, message):
    if not ok:
        raise Refusal(code, message)


def sha256(blob):
    return hashlib.sha256(blob).hexdigest()


def git_blob(blob):
    return hashlib.sha1(b"blob " + str(len(blob)).encode() + b"\0" + blob).hexdigest()


def canonical(record):
    return (json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def read_exact(path, max_size=16_000_000):
    try:
        meta = path.lstat()
    except OSError:
        raise Refusal("MISSING_FILE", f"missing required file {path.name}")
    require(stat.S_ISREG(meta.st_mode) and 0 < meta.st_size <= max_size,
            "INVALID_FILE", f"not a bounded regular file: {path.name}")
    try:
        blob = path.read_bytes()
    except OSError as exc:
        raise Refusal("READ_FAILED", f"failed to read {path.name}: {type(exc).__name__}")
    require(len(blob) == meta.st_size, "FILE_CHANGED", path.name)
    return blob


def parse_json(blob):
    def no_dupes(items):
        obj = {}
        for key, value in items:
            require(key not in obj, "DUPLICATE_JSON_KEY", str(key))
            obj[key] = value
        return obj
    try:
        return json.loads(blob.decode("utf-8"), object_pairs_hook=no_dupes,
                          parse_constant=lambda value: require(False, "INVALID_JSON", value))
    except (UnicodeError, json.JSONDecodeError):
        raise Refusal("INVALID_JSON", "invalid UTF-8 or JSON")


def inspect(root, manifest_pin=MANIFEST_BLOB):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), "HANDOFF_DIRECTORY", "handoff must be a real directory")
    manifest_blob = read_exact(root / "manifest.json", 4_000_000)
    require(git_blob(manifest_blob) == manifest_pin, "MANIFEST_PIN", "manifest Git blob is not pinned")
    manifest = parse_json(manifest_blob)
    require(isinstance(manifest, dict) and manifest.get("schema_version") == "skill-mason-catalog-manifest-v1",
            "MANIFEST_SCHEMA", "unsupported manifest")
    src = manifest.get("source")
    require(isinstance(src, dict) and (src.get("repository"), src.get("commit"), src.get("git_tree_sha1")) ==
            (ORIGIN, COMMIT, TREE), "SOURCE_PIN", "source origin/commit/tree mismatch")
    readiness = manifest.get("readiness")
    require(isinstance(readiness, dict) and readiness.get("composition_eligibility") ==
            "requires-independent-target-specific-assessment", "ELIGIBILITY_CLAIM", "unapproved readiness upgrade")
    declarations = manifest.get("artifacts")
    require(isinstance(declarations, list) and len(declarations) == 2, "ARTIFACT_MANIFEST", "expected two artifacts")
    entries = {}
    for item in declarations:
        require(isinstance(item, dict) and isinstance(item.get("path"), str) and item["path"] not in entries,
                "ARTIFACT_MANIFEST", "duplicate or malformed artifact declaration")
        entries[item["path"]] = item
    require(set(entries) == {"governed.ndjson", "discovery-manifests.json"},
            "ARTIFACT_MANIFEST", "missing or unrecognized artifact")
    data = {}
    for name in sorted(entries):
        item = entries[name]
        n, digest = item.get("bytes"), item.get("sha256")
        require(type(n) is int and 0 < n <= 16_000_000 and isinstance(digest, str) and
                len(digest) == 64 and all(c in "0123456789abcdef" for c in digest),
                "ARTIFACT_MANIFEST", f"invalid artifact specification: {name}")
        payload = read_exact(root / name)
        require(len(payload) == n and sha256(payload) == digest, "ARTIFACT_INTEGRITY",
                f"content does not match manifest: {name}")
        data[name] = payload
    require(isinstance(parse_json(data["discovery-manifests.json"]), dict),
            "DISCOVERY_SCHEMA", "discovery manifest is not an object")
    raw = data["governed.ndjson"]
    require(raw.endswith(b"\n") and b"\r" not in raw, "RECORD_SERIALIZATION", "records must use LF")
    counts, statuses, ids = Counter(), Counter(), set()
    lines = raw.splitlines()
    for n, line in enumerate(lines, 1):
        require(0 < len(line) <= 200_000, "RECORD_SERIALIZATION", f"invalid record length: {n}")
        record = parse_json(line)
        require(isinstance(record, dict) and record.get("schema_version") == "skill-mason-catalog-record-v1",
                "RECORD_SCHEMA", f"unsupported record: {n}")
        require(canonical(record) == line+b"\n", "RECORD_SERIALIZATION", f"non-canonical record: {n}")
        rid = record.get("record_id")
        require(isinstance(rid, str) and rid and rid not in ids, "DUPLICATE_ID", f"record identity at {n}")
        ids.add(rid)
        kind = record.get("source_class")
        require(kind in ("first-party", "third-party"), "RECORD_SCHEMA", f"source class at {n}")
        mapped, review = record.get("capability_mapping"), record.get("review")
        comp, rights = record.get("composition"), record.get("rights")
        require(all(isinstance(x, dict) for x in (mapped, review, comp, rights)), "RECORD_SCHEMA",
                f"missing metadata at {n}")
        state = mapped.get("state")
        require(state in ("evidence-linked", "unmapped") and
                isinstance(mapped.get("evidence_linked_paths"), list) and
                isinstance(mapped.get("name_only_hints"), list), "RECORD_SCHEMA", f"mapping at {n}")
        require(state != "unmapped" or not mapped["evidence_linked_paths"],
                "MAPPING_CONTRADICTION", f"unmapped has coverage at {n}")
        require(comp.get("eligibility") == "not-assessed" and
                comp.get("composable_method_contract") is None and
                comp.get("export_is_not_admission_or_permission") is True,
                "ELIGIBILITY_CLAIM", f"unearned eligibility at {n}")
        require(rights.get("package_redistribution_clearance") == "not-established-by-export",
                "RIGHTS_CLAIM", f"unearned rights at {n}")
        status = review.get("semantic_status")
        require(isinstance(status, str) and status, "RECORD_SCHEMA", f"review state at {n}")
        counts[kind] += 1
        counts[state] += 1
        statuses[status] += 1
    declared = manifest.get("counts")
    require(isinstance(declared, dict), "COUNT_MISMATCH", "no population declaration")
    observed = {"governed_records": len(lines), "first_party": counts["first-party"],
                "third_party": counts["third-party"], "mapped": counts["evidence-linked"],
                "unmapped": counts["unmapped"]}
    require(all(type(declared.get(k)) is int and declared[k] == v for k, v in observed.items()) and
            declared.get("semantic_states") == dict(statuses), "COUNT_MISMATCH", "review populations disagree")
    for k, field in (("source_files", "source_files"), ("submodule_pins", "submodule_pins")):
        require(isinstance(manifest.get(field), list) and declared.get(k) == len(manifest[field]),
                "COUNT_MISMATCH", f"incorrect {k} inventory count")
    return {"schema": "qortara/catalog-inspection/1", "source": src,
            "pinned_manifest_git_blob_sha1": manifest_pin,
            "artifact_sha256": {k: entries[k]["sha256"] for k in sorted(entries)},
            "counts": declared, "preserved_record_ids": len(ids), "artifact_integrity": "PASS",
            "source_commit_tree_authentication": "NOT_RUN",
            "individual_source_files_verified": False, "source_rights_assessed": False,
            "coverage_assessed": False, "prism_evaluated": False,
            "composition_eligible": False, "production_qualified": False,
            "next_gate": "authenticate source commit and every used source package; qualify rights, host and coverage"}


def main():
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--handoff", required=True, type=Path)
    arg.add_argument("--report", type=Path)
    opts = arg.parse_args()
    try:
        report = json.dumps(inspect(opts.handoff), sort_keys=True, indent=2) + "\n"
        if opts.report:
            with opts.report.open("x", encoding="utf-8") as out:
                out.write(report)
        print(report, end="")
        return 0
    except Refusal as exc:
        print(json.dumps({"state": "REFUSED", "code": exc.code,
                          "message": str(exc), "composition_eligible": False}), file=sys.stderr)
        return 2
    except FileExistsError:
        print('{"state":"REFUSED","code":"REPORT_EXISTS","composition_eligible":false}', file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
