"""MLOps commands — model lifecycle, A/B testing, batch inference, etc."""

from openeye_ai.commands.mlops._app import mlops_app

# Import submodules so their @mlops_app.command() decorators run.
import openeye_ai.commands.mlops.ops as _ops  # noqa: E402, F401
import openeye_ai.commands.mlops.registry as _registry  # noqa: E402, F401
import openeye_ai.commands.mlops.testing as _testing  # noqa: E402, F401

__all__ = ["mlops_app"]
