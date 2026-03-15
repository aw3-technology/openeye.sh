"""Governance Engine — loads policies, evaluates context, aggregates verdicts."""

from __future__ import annotations

import logging
import time
from typing import Any

from governance.audit import AuditLog
from governance.context import GovernanceContext
from governance.loader import load_preset, load_yaml, resolve_config
from governance.models import (
    Enforcement,
    GovernanceConfig,
    GovernanceResult,
    GovernanceSettings,
    GovernanceStatus,
    GovernanceVerdict,
    PolicyConfig,
    PolicyDecision,
    PolicyDomain,
    PolicyInfo,
)
from governance.policies.base import GovernancePolicy
from governance.registry import PolicyRegistry

logger = logging.getLogger(__name__)

# Decision severity order for most-restrictive-wins
_DECISION_SEVERITY = {
    PolicyDecision.DENY: 4,
    PolicyDecision.MODIFY: 3,
    PolicyDecision.WARN: 2,
    PolicyDecision.AUDIT_ONLY: 1,
    PolicyDecision.ALLOW: 0,
}


class GovernanceEngine:
    """Core governance engine — evaluates contexts against active policies.

    The engine aggregates results using a most-restrictive-wins strategy:
    if any policy denies, the overall verdict is DENY.

    ``fail_open=False`` (default) means governance errors → DENY.
    """

    def __init__(
        self,
        config: GovernanceConfig | None = None,
        config_path: str | None = None,
    ) -> None:
        self.registry = PolicyRegistry()
        self.registry.discover_plugins()
        self.audit = AuditLog()
        self._policies: dict[str, GovernancePolicy] = {}
        self._configs: dict[str, PolicyConfig] = {}
        self._settings = GovernanceSettings()
        self._config_name = ""
        self._domain = PolicyDomain.UNIVERSAL

        if config_path:
            config = load_yaml(config_path)
        if config:
            self.load_config(config)

    # ------------------------------------------------------------------ #
    #  Configuration
    # ------------------------------------------------------------------ #

    def load_config(self, config: GovernanceConfig) -> None:
        """Load a full governance configuration, resolving presets."""
        resolved = resolve_config(config)
        self._settings = resolved.settings
        self._config_name = resolved.name
        self._domain = resolved.domain
        self.audit.log_all = self._settings.log_all_decisions

        self._policies.clear()
        self._configs.clear()

        for pc in resolved.policies:
            self._configs[pc.name] = pc
            if pc.enabled:
                try:
                    self._policies[pc.name] = self.registry.create_policy(pc)
                except Exception as exc:
                    logger.error("Failed to create policy %s: %s", pc.name, exc)

    def load_preset(self, name: str) -> None:
        """Load a built-in preset by name."""
        config = load_preset(name)
        self.load_config(config)

    def enable_policy(self, name: str) -> bool:
        """Enable a previously loaded policy."""
        if name not in self._configs:
            return False
        self._configs[name].enabled = True
        if name not in self._policies:
            try:
                self._policies[name] = self.registry.create_policy(self._configs[name])
            except Exception as exc:
                logger.error("Failed to enable policy %s: %s", name, exc)
                return False
        return True

    def disable_policy(self, name: str) -> bool:
        """Disable a policy (keeps config, stops evaluation)."""
        if name not in self._configs:
            return False
        self._configs[name].enabled = False
        self._policies.pop(name, None)
        return True

    # ------------------------------------------------------------------ #
    #  Evaluation
    # ------------------------------------------------------------------ #

    def evaluate(self, context: GovernanceContext) -> GovernanceVerdict:
        """Run all active policies against a context and return aggregated verdict."""
        t0 = time.perf_counter()
        all_results: list[GovernanceResult] = []
        violations: list[GovernanceResult] = []
        warnings: list[GovernanceResult] = []
        denied_actions: list[str] = []
        merged_modifications: dict[str, Any] = {}

        for name, policy in self._policies.items():
            pc = self._configs[name]
            if not policy.applies_to(context):
                continue

            try:
                results = policy.evaluate(context)
            except Exception as exc:
                logger.error("Policy %s evaluation error: %s", name, exc)
                if self._settings.fail_open:
                    continue
                # Fail-closed: treat error as deny
                results = [
                    GovernanceResult(
                        policy_name=name,
                        decision=PolicyDecision.DENY,
                        reason=f"Policy evaluation error: {exc}",
                        severity=pc.severity,
                    )
                ]

            for result in results:
                # Downgrade to warn/audit based on enforcement mode
                if pc.enforcement == Enforcement.AUDIT_ONLY:
                    result.decision = PolicyDecision.AUDIT_ONLY
                elif pc.enforcement == Enforcement.WARN_ONLY and result.decision == PolicyDecision.DENY:
                    result.decision = PolicyDecision.WARN

                all_results.append(result)

                if result.decision == PolicyDecision.DENY:
                    violations.append(result)
                    denied_actions.extend(result.affected_objects)
                elif result.decision == PolicyDecision.WARN:
                    warnings.append(result)

                if result.modifications:
                    merged_modifications.update(result.modifications)

        # Most restrictive wins
        overall = PolicyDecision.ALLOW
        for r in all_results:
            if _DECISION_SEVERITY.get(r.decision, 0) > _DECISION_SEVERITY.get(overall, 0):
                overall = r.decision

        elapsed_ms = (time.perf_counter() - t0) * 1000

        verdict = GovernanceVerdict(
            overall_decision=overall,
            results=all_results,
            violations=violations,
            warnings=warnings,
            denied_actions=denied_actions,
            modifications=merged_modifications,
            evaluation_ms=round(elapsed_ms, 2),
            policies_evaluated=len(self._policies),
        )

        self.audit.record_verdict(verdict, frame_id=context.frame_id)
        return verdict

    # ------------------------------------------------------------------ #
    #  Status / introspection
    # ------------------------------------------------------------------ #

    def get_status(self) -> GovernanceStatus:
        return GovernanceStatus(
            active=bool(self._policies),
            config_name=self._config_name,
            domain=self._domain,
            total_policies=len(self._configs),
            enabled_policies=len(self._policies),
            total_evaluations=self.audit.total_evaluations,
            total_violations=self.audit.total_violations,
            total_warnings=self.audit.total_warnings,
            fail_open=self._settings.fail_open,
        )

    def list_policies(self) -> list[PolicyInfo]:
        """List all configured policies with their current state."""
        infos: list[PolicyInfo] = []
        for name, pc in self._configs.items():
            infos.append(
                PolicyInfo(
                    name=pc.name,
                    type=pc.type,
                    domain=pc.domain,
                    enabled=pc.enabled,
                    severity=pc.severity,
                    enforcement=pc.enforcement,
                    is_plugin=pc.type == "plugin",
                )
            )
        return infos

    def list_available_types(self) -> list[PolicyInfo]:
        """List all available policy types (built-in + plugins)."""
        return self.registry.list_available()

    @property
    def config_yaml(self) -> str:
        """Serialize current config back to YAML."""
        import yaml

        config = GovernanceConfig(
            version="1.0",
            name=self._config_name,
            domain=self._domain,
            policies=list(self._configs.values()),
            settings=self._settings,
        )
        return yaml.dump(config.model_dump(mode="json"), default_flow_style=False, sort_keys=False)

    def update_config_yaml(self, yaml_str: str) -> None:
        """Parse and apply a YAML string as new governance config."""
        import yaml as yaml_lib

        raw = yaml_lib.safe_load(yaml_str)
        config = GovernanceConfig.model_validate(raw)
        self.load_config(config)
