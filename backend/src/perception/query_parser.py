from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ParsedQuery:
    intent: str  # "count", "existence", "location", "objects_on", "relation", "describe"
    raw: str
    label: str = ""
    subject: str = ""
    relation_word: str = ""
    object_label: str = ""


def parse_query(question: str) -> ParsedQuery:
    q = question.strip().lower().rstrip("?").strip()

    m = re.match(r"how many (.+?)s?\s+(are|do|is)\s+(there|you see)", q)
    if m:
        return ParsedQuery(intent="count", raw=question, label=m.group(1).strip())

    m = re.match(r"how many (.+)", q)
    if m:
        return ParsedQuery(intent="count", raw=question, label=m.group(1).strip().rstrip("s"))

    m = re.match(r"(?:is|are) there (?:a |an |any |the )?(.+)", q)
    if m:
        desc = m.group(1).strip()
        rel_match = re.match(
            r"(.+?) (on|near|above|below) (?:the |a )?(.+)", desc
        )
        if rel_match:
            return ParsedQuery(
                intent="relation", raw=question,
                subject=rel_match.group(1).strip(),
                relation_word=rel_match.group(2).strip(),
                object_label=rel_match.group(3).strip(),
            )
        return ParsedQuery(intent="existence", raw=question, label=desc)

    m = re.match(r"where (?:is|are) (?:the |a )?(.+)", q)
    if m:
        return ParsedQuery(intent="location", raw=question, label=m.group(1).strip())

    m = re.match(r"what (?:objects?|things?|items?) (?:are|is) (?:on|near|above|below) (?:the )?(.+)", q)
    if m:
        return ParsedQuery(intent="objects_on", raw=question, label=m.group(1).strip())

    m = re.match(
        r"is (?:the |a )?(.+?) (on|near|above|below|left of|right of|next to|in front of|behind) (?:the |a )?(.+)",
        q,
    )
    if m:
        return ParsedQuery(
            intent="relation", raw=question,
            subject=m.group(1).strip(),
            relation_word=m.group(2).strip(),
            object_label=m.group(3).strip(),
        )

    return ParsedQuery(intent="describe", raw=question)
