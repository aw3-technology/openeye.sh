"""Policy registry — discovers and instantiates governance policies."""

from __future__ import annotations

import importlib
import importlib.util
import logging
import sys
from pathlib import Path
from typing import Type

from governance.models import PolicyConfig, PolicyDomain, PolicyInfo
from governance.policies.base import GovernancePolicy

logger = logging.getLogger(__name__)

# Built-in policy type → class mapping (populated by _register_builtins)
_BUILTIN_TYPES: dict[str, Type[GovernancePolicy]] = {}


def _register_builtins() -> None:
    """Lazily discover built-in policies in governance.policies.*."""
    if _BUILTIN_TYPES:
        return

    from governance.policies.zone_policy import ZonePolicy
    from governance.policies.object_restriction import ObjectRestrictionPolicy
    from governance.policies.action_filter import ActionFilterPolicy
    from governance.policies.pii_filter import PIIFilterPolicy
    from governance.policies.interaction_boundary import InteractionBoundaryPolicy
    from governance.policies.rate_limiter import RateLimiterPolicy

    for cls in [
        ZonePolicy,
        ObjectRestrictionPolicy,
        ActionFilterPolicy,
        PIIFilterPolicy,
        InteractionBoundaryPolicy,
        RateLimiterPolicy,
    ]:
        _BUILTIN_TYPES[cls.name] = cls


class PolicyRegistry:
    """Discovers built-in and plugin policies, instantiates by type."""

    def __init__(self) -> None:
        self._custom_types: dict[str, Type[GovernancePolicy]] = {}
        self._plugin_dirs: list[Path] = []

    def discover_plugins(self, dirs: list[str | Path] | None = None) -> None:
        """Scan directories for GovernancePolicy subclasses."""
        _register_builtins()

        scan_dirs = list(dirs or [])
        # Default plugin directories
        scan_dirs.extend([
            Path.home() / ".openeye" / "governance" / "plugins",
            Path.cwd() / "governance" / "plugins",
        ])

        for d in scan_dirs:
            d = Path(d)
            if not d.is_dir():
                continue
            self._plugin_dirs.append(d)
            for py_file in d.glob("*.py"):
                if py_file.name.startswith("_"):
                    continue
                try:
                    self._load_plugin_file(py_file)
                except Exception as exc:
                    logger.warning("Failed to load plugin %s: %s", py_file, exc)

    def _load_plugin_file(self, path: Path) -> None:
        """Import a Python file and register any GovernancePolicy subclasses."""
        module_name = f"governance_plugin_{path.stem}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            return
        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = mod
        spec.loader.exec_module(mod)

        for attr_name in dir(mod):
            attr = getattr(mod, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, GovernancePolicy)
                and attr is not GovernancePolicy
                and hasattr(attr, "name")
            ):
                self._custom_types[attr.name] = attr
                logger.info("Registered plugin policy: %s from %s", attr.name, path)

    def _load_module_class(self, module_path: str, class_name: str) -> Type[GovernancePolicy]:
        """Import a policy class from a dotted module path."""
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        if not issubclass(cls, GovernancePolicy):
            raise TypeError(f"{class_name} is not a GovernancePolicy subclass")
        return cls

    def create_policy(self, config: PolicyConfig) -> GovernancePolicy:
        """Instantiate a policy from its configuration."""
        _register_builtins()

        # Plugin type: load from module path
        if config.type == "plugin" and config.module and config.class_name:
            cls = self._load_module_class(config.module, config.class_name)
            return cls(config)

        # Check built-in types
        if config.type in _BUILTIN_TYPES:
            return _BUILTIN_TYPES[config.type](config)

        # Check discovered plugins
        if config.type in self._custom_types:
            return self._custom_types[config.type](config)

        raise ValueError(f"Unknown policy type: {config.type}")

    def list_available(self) -> list[PolicyInfo]:
        """Return info about all available policy types."""
        _register_builtins()
        infos: list[PolicyInfo] = []

        for type_name, cls in {**_BUILTIN_TYPES, **self._custom_types}.items():
            infos.append(
                PolicyInfo(
                    name=type_name,
                    type=type_name,
                    domain=cls.domain,
                    description=cls.description,
                    is_plugin=type_name in self._custom_types,
                )
            )
        return infos
