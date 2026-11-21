"""Lexical source-value tokens, never serialized JSON labels or substring matches.

Read-only index primitive. Tokens show mentions, not correctness or rights.
"""
import re
import unicodedata

_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)


def tokens(value):
    """Case-folded Unicode word tokens. Punctuation and underscores are boundaries."""
    return frozenset(_TOKEN.findall(unicodedata.normalize("NFC", value).casefold()))


def source_values(node):
    """Traverse declared values only, not object keys or fabricated labels."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, list):
        for item in node:
            yield from source_values(item)
    elif isinstance(node, dict):
        for item in node.values():
            yield from source_values(item)


def source_tokens(node):
    """Merge tokens across values without permitting key-only matches."""
    result = set()
    for value in source_values(node):
        result.update(tokens(value))
    return frozenset(result)
