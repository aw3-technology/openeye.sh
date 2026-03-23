"""Model management commands — list, pull, remove, add-model, register-adapter, update-registry."""

from openeye_ai.commands.models_list import list_models
from openeye_ai.commands.models_pull import _pull_single, pull
from openeye_ai.commands.models_registry import add_model, register_adapter, update_registry
from openeye_ai.commands.models_remove import remove

__all__ = [
    "add_model",
    "list_models",
    "pull",
    "_pull_single",
    "register_adapter",
    "remove",
    "update_registry",
]
