"""Data models for the governance engine."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class PolicyDomain(str, Enum):
    ROBOTICS = "robotics"
    DESKTOP_AGENT = "desktop_agent"
    UNIVERSAL = "universal"


class PolicyDecision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    MODIFY = "modify"
    WARN = "warn"
    AUDIT_ONLY = "audit_only"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Enforcement(str, Enum):
    ENFORCE = "enforce"
    WARN_ONLY = "warn_only"
    AUDIT_ONLY = "audit_only"


# --------------------------------------------------------------------------- #
#  Policy configuration
# --------------------------------------------------------------------------- #


class PolicyConfig(BaseModel):
    """Configuration for a single policy instance."""

    name: str
    type: str
    enabled: bool = True
    domain: PolicyDomain = PolicyDomain.UNIVERSAL
    severity: Severity = Severity.MEDIUM
    enforcement: Enforcement = Enforcement.ENFORCE
    config: dict[str, Any] = Field(default_factory=dict)
    # For plugin policies
    module: Optional[str] = None
    class_name: Optional[str] = None


# --------------------------------------------------------------------------- #
#  Governance results
# --------------------------------------------------------------------------- #


class GovernanceResult(BaseModel):
    """Result from a single policy evaluation."""

    policy_name: str
    decision: PolicyDecision
    reason: str
    severity: Severity = Severity.MEDIUM
    modifications: dict[str, Any] = Field(default_factory=dict)
    affected_objects: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GovernanceVerdict(BaseModel):
    """Aggregated verdict from all active policies."""

    overall_decision: PolicyDecision = PolicyDecision.ALLOW
    results: list[GovernanceResult] = Field(default_factory=list)
    violations: list[GovernanceResult] = Field(default_factory=list)
    warnings: list[GovernanceResult] = Field(default_factory=list)
    denied_actions: list[str] = Field(default_factory=list)
    modifications: dict[str, Any] = Field(default_factory=dict)
    evaluation_ms: float = 0.0
    policies_evaluated: int = 0


# --------------------------------------------------------------------------- #
#  Governance YAML schema
# --------------------------------------------------------------------------- #


class GovernanceConfig(BaseModel):
    """Top-level YAML governance configuration."""

    version: str = "1.0"
    name: str = "default"
    domain: PolicyDomain = PolicyDomain.UNIVERSAL
    extends: list[str] = Field(default_factory=list)
    policies: list[PolicyConfig] = Field(default_factory=list)
    settings: GovernanceSettings = Field(default_factory=lambda: GovernanceSettings())


class GovernanceSettings(BaseModel):
    """Global governance settings."""

    log_all_decisions: bool = True
    fail_open: bool = False
    evaluation_timeout_ms: int = 50


# --------------------------------------------------------------------------- #
#  Audit
# --------------------------------------------------------------------------- #


class AuditEntry(BaseModel):
    """A single audit log entry."""

    timestamp: float
    frame_id: Optional[int] = None
    policy_name: str
    decision: PolicyDecision
    reason: str
    severity: Severity
    affected_objects: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


# --------------------------------------------------------------------------- #
#  Status / API responses
# --------------------------------------------------------------------------- #


class GovernanceStatus(BaseModel):
    """Current governance engine status."""

    active: bool = False
    config_name: str = ""
    domain: PolicyDomain = PolicyDomain.UNIVERSAL
    total_policies: int = 0
    enabled_policies: int = 0
    total_evaluations: int = 0
    total_violations: int = 0
    total_warnings: int = 0
    fail_open: bool = False


class PolicyInfo(BaseModel):
    """Information about an available policy."""

    name: str
    type: str
    domain: PolicyDomain
    description: str = ""
    enabled: bool = False
    severity: Severity = Severity.MEDIUM
    enforcement: Enforcement = Enforcement.ENFORCE
    is_plugin: bool = False
