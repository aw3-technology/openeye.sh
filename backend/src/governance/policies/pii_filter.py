"""PII filter policy — regex patterns for email/phone/SSN/CC. Redact or block."""

from __future__ import annotations

import re

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy

# Built-in PII patterns
_PII_PATTERNS: dict[str, str] = {
    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "phone": r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
    "ip_address": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
}


class PIIFilterPolicy(GovernancePolicy):
    name = "pii_filter"
    version = "1.0"
    domain = PolicyDomain.DESKTOP_AGENT
    description = "Detect and redact PII (email, phone, SSN, credit card) in screen text."

    def _setup(self, params: dict) -> None:
        self.redact_patterns: list[dict] = params.get("redact_patterns", [])
        self.custom_patterns: dict[str, str] = params.get("custom_patterns", {})
        # If no patterns configured, use all built-in patterns with redact action
        if not self.redact_patterns:
            self.redact_patterns = [
                {"type": t, "action": "redact"} for t in _PII_PATTERNS
            ]

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []

        if not context.is_desktop or not context.desktop:
            return results

        desktop = context.desktop

        # Check screen text
        text_sources = [
            ("screen_text", desktop.screen_text),
            ("clipboard", desktop.clipboard_text),
        ]
        # Check UI element text
        for elem in desktop.ui_elements:
            if elem.text:
                text_sources.append((f"ui:{elem.element_type}", elem.text))

        for source_name, text in text_sources:
            if not text:
                continue
            for pattern_def in self.redact_patterns:
                pii_type = pattern_def.get("type", "")
                action = pattern_def.get("action", "redact")

                regex = self.custom_patterns.get(pii_type) or _PII_PATTERNS.get(pii_type)
                if not regex:
                    continue

                matches = re.findall(regex, text)
                if matches:
                    if action == "block_and_alert":
                        decision = PolicyDecision.DENY
                        severity = Severity.CRITICAL
                    else:
                        decision = PolicyDecision.MODIFY
                        severity = Severity.HIGH

                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=decision,
                            reason=f"PII detected ({pii_type}) in {source_name}: {len(matches)} match(es)",
                            severity=severity,
                            modifications={"redact": pii_type, "source": source_name, "count": len(matches)},
                            metadata={"pii_type": pii_type, "source": source_name},
                        )
                    )

        return results
