"""Conservative reference and asset-review inventory over ALREADY verified source bytes.

A recorded package can contain complete, correct Git bytes while retaining
undeclared imports, dynamic references, unknown license obligations, and no host
permission. This scanner is a bounded lead inventory, NEVER dependency closure.
"""
from collections import Counter
import posixpath
import re
from urllib.parse import unquote, urlsplit

from scripts.catalog_handoff import Refusal, canonical, require, sha256

SCHEMA = "qortara/package-reference-inventory/1"
LINK = re.compile(r"!?\[[^\]\n]{0,300}\]\(([^)\n]{1,500})\)")
FRONTMATTER_LICENSE = re.compile(r"(?im)^license\s*:\s*(.{1,250})\s*$")
LICENSE_FILE = re.compile(r"(?i)(?<![A-Za-z0-9._-])(?:LICENSE|LICENCE|COPYING|NOTICE)(?:\.[A-Za-z0-9_-]{1,16})?(?![A-Za-z0-9._-])")
MAX_FILES = 2000
MAX_REFERENCES = 2000
MAX_MARKDOWN_SIZE = 2_000_000
MAX_REPORTED = 50


def _role(path):
    basename = posixpath.basename(path)
    upper = basename.upper()
    if path == "SKILL.md":
        return "ENTRYPOINT_INSTRUCTIONS"
    if upper.startswith(("LICENSE", "LICENCE", "NOTICE", "COPYING")):
        return "LICENSE_OR_NOTICE_EVIDENCE_ONLY"
    if path.lower().endswith((".md", ".markdown", ".mdx")):
        return "DOCUMENT_REFERENCE"
    if path.lower().endswith((".py", ".js", ".mjs", ".ts", ".sh", ".ps1", ".bat", ".exe")):
        return "CODE_OR_EXECUTABLE_NOT_AUTHORIZED"
    if path.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".mp3", ".wav", ".pdf")):
        return "MEDIA_OR_BINARY_ASSET_REVIEW_REQUIRED"
    return "OTHER_PACKAGE_FILE_REVIEW_REQUIRED"


def _resolve(source, token, known):
    """Resolve inline links relative to their containing Markdown file."""
    token = token.strip()
    target = token.split(" ", 1)[0].strip("<>")
    if not target or target.startswith("#"):
        return "fragment_or_empty", None
    require(len(target) <= 500 and not any(ord(ch) < 32 for ch in target),
            "PACKAGE_REFERENCES", "unbounded or control-containing link")
    try:
        parsed = urlsplit(target)
    except ValueError:
        raise Refusal("PACKAGE_REFERENCES", "invalid Markdown link URL")
    if parsed.scheme or parsed.netloc or target.startswith("//"):
        return "remote_or_scheme", target[:160]
    raw_path = unquote(parsed.path)
    if not raw_path:
        return "fragment_or_empty", None
    if raw_path.startswith("/") or "\\" in raw_path or "\x00" in raw_path:
        return "outside_package", raw_path[:160]
    local = posixpath.normpath(posixpath.join(posixpath.dirname(source), raw_path))
    if local == ".." or local.startswith("../"):
        return "outside_package", raw_path[:160]
    if local in known:
        return "verified_local_file_lead", local
    return "missing_local_file", local[:160]


def _license_pointer(skill_text, known):
    """The common Agent Skills license header is a LEAD, not legal approval."""
    if not skill_text.startswith("---\n"):
        return {"raw_field_present": False, "matched": [], "unresolved": [],
                "declared_text_sha256": None}
    close = skill_text.find("\n---\n", 4, 16_000)
    if close < 0:
        return {"raw_field_present": False, "matched": [], "unresolved": [],
                "declared_text_sha256": None}
    header = skill_text[4:close]
    candidates = FRONTMATTER_LICENSE.findall(header)
    require(len(candidates) <= 1, "PACKAGE_LICENSE", "ambiguous repeated license fields")
    if not candidates:
        return {"raw_field_present": False, "matched": [], "unresolved": [],
                "declared_text_sha256": None}
    declared = candidates[0].strip().strip("\"'")
    names = sorted(set(LICENSE_FILE.findall(declared)))
    matched = sorted(x for x in names if x in known)
    unresolved = sorted(x for x in names if x not in known)
    return {"raw_field_present": True, "matched": matched, "unresolved": unresolved,
            "declared_text_sha256": sha256(declared.encode("utf-8"))}


def build_reference_inventory(verified_bytes, source_files):
    """Consume exact-package verified raw bytes; nothing fetched, executed or licensed."""
    require(isinstance(verified_bytes, dict) and isinstance(source_files, list) and
            0 < len(source_files) <= MAX_FILES,
            "PACKAGE_INVENTORY", "missing/oversized source package")
    paths = []
    review_files = []
    for item in source_files:
        require(isinstance(item, dict) and set(item) >=
                {"relative_path", "sha256", "git_blob_sha1", "bytes"},
                "PACKAGE_INVENTORY", "incomplete verified file receipt")
        path = item["relative_path"]
        require(isinstance(path, str) and 0 < len(path) <= 300 and
                not path.startswith("/") and not path.startswith("../") and
                "/../" not in path and not "\\" in path and "\x00" not in path,
                "PACKAGE_INVENTORY", "unsafe source path")
        raw = verified_bytes.get(path)
        require(isinstance(raw, bytes) and
                len(raw) == item["bytes"] and
                sha256(raw) == item["sha256"],
                "PACKAGE_INVENTORY", "source bytes do not match verified file receipt")
        paths.append(path)
        review_files.append({
            "relative_path": path, "sha256": item["sha256"],
            "git_blob_sha1": item["git_blob_sha1"],
            "bytes": item["bytes"], "role": _role(path),
            "license_and_asset_rights": "UNASSESSED",
            "host_use_permission": "NOT_ESTABLISHED"})
    require(paths == sorted(set(paths)) and "SKILL.md" in paths and
            set(paths) == set(verified_bytes),
            "PACKAGE_INVENTORY", "source file inventory is not complete and sorted")
    known = set(paths)
    skill = verified_bytes["SKILL.md"]
    require(len(skill) <= MAX_MARKDOWN_SIZE,
            "PACKAGE_REFERENCES", "entrypoint too large to inspect as Markdown")
    try:
        skill_text = skill.decode("utf-8", "strict")
    except UnicodeError:
        raise Refusal("PACKAGE_REFERENCES", "entrypoint must be UTF-8")
    license_pointer = _license_pointer(skill_text, known)
    counts = Counter()
    matched, missing, outside, remote = set(), set(), set(), set()
    markdown_scanned = 0
    scanned_links = 0
    for item in review_files:
        path = item["relative_path"]
        if not path.lower().endswith((".md", ".markdown", ".mdx")):
            continue
        raw = verified_bytes[path]
        require(len(raw) <= MAX_MARKDOWN_SIZE,
                "PACKAGE_REFERENCES", "oversized Markdown dependency file")
        try:
            source = raw.decode("utf-8", "strict")
        except UnicodeError:
            raise Refusal("PACKAGE_REFERENCES", "invalid UTF-8 Markdown dependency file")
        markdown_scanned += 1
        for token in LINK.findall(source):
            scanned_links += 1
            require(scanned_links <= MAX_REFERENCES,
                    "PACKAGE_REFERENCES", "too many package Markdown reference leads")
            classification, target = _resolve(path, token, known)
            counts[classification] += 1
            if classification == "verified_local_file_lead":
                matched.add(target)
            elif classification == "missing_local_file":
                missing.add(target)
            elif classification == "outside_package":
                outside.add(target)
            elif classification == "remote_or_scheme":
                remote.add(target)
    licenses = [i for i in review_files if
                i["role"] == "LICENSE_OR_NOTICE_EVIDENCE_ONLY"]
    return {
        "schema": SCHEMA, "state": "VERIFIED_SOURCE_BYTES_REFERENCE_LEADS_ONLY",
        "file_count": len(review_files), "file_list_sha256": sha256(canonical(review_files)),
        "files_requiring_individual_rights_review": review_files,
        "license_and_notice_files_observed_not_cleared": licenses,
        "frontmatter_license_pointer": license_pointer,
        "markdown_files_scanned": markdown_scanned,
        "inline_markdown_reference_count": scanned_links,
        "inline_reference_classification_counts": dict(sorted(counts.items())),
        "local_matched_reference_leads": sorted(matched)[:MAX_REPORTED],
        "local_missing_reference_leads": sorted(missing)[:MAX_REPORTED],
        "outside_package_reference_leads": sorted(outside)[:MAX_REPORTED],
        "remote_or_scheme_reference_leads": sorted(remote)[:MAX_REPORTED],
        "source_files_sha256_verified_by_caller": True,
        "other_reference_syntaxes_and_dynamic_dependencies_not_assessed": True,
        "all_instructional_references_closed": False,
        "dependency_closure_proven": False,
        "each_asset_rights_cleared": False,
        "source_license_and_notice_obligations_assessed": False,
        "source_method_semantic_fitness_established": False,
        "target_host_approved": False,
        "composition_eligible": False,
    }
