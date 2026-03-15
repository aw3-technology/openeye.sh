"""Base class for all governance policies."""

from __future__ import annotations

from abc import ABC, abstractmethod

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyConfig, PolicyDomain


class GovernancePolicy(ABC):
    """Abstract base for governance policies.

    Subclasses declare their domain and implement ``evaluate()`` which
    receives a ``GovernanceContext`` and returns a list of
    ``GovernanceResult`` objects.
    """

    name: str = "base"
    version: str = "1.0"
    domain: PolicyDomain = PolicyDomain.UNIVERSAL
    description: str = ""

    def __init__(self, config: PolicyConfig) -> None:
        self.config = config
        self._setup(config.config)

    def _setup(self, params: dict) -> None:
        """Override to process policy-specific configuration parameters."""

    def applies_to(self, context: GovernanceContext) -> bool:
        """Return True if this policy should evaluate the given context."""
        if self.domain == PolicyDomain.UNIVERSAL:
            return True
        if self.domain == PolicyDomain.ROBOTICS:
            return context.is_robotics
        if self.domain == PolicyDomain.DESKTOP_AGENT:
            return context.is_desktop
        return False

    @abstractmethod
    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        """Evaluate the context against this policy.

        Returns a list of GovernanceResult — one per finding.
        An empty list means the policy found no issues.
        """
