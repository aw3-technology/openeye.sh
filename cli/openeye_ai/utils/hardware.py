"""Hardware detection for model compatibility."""

from __future__ import annotations


def detect_hardware() -> dict[str, bool]:
    """Detect available compute hardware.

    Returns dict with keys: cpu, cuda, mps.
    """
    hw = {"cpu": True, "cuda": False, "mps": False}
    try:
        import torch

        hw["cuda"] = torch.cuda.is_available()
        hw["mps"] = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    except ImportError:
        pass
    return hw


def format_hardware_tags(hw_dict: dict[str, bool]) -> str:
    """Return Rich-styled string of hardware compatibility tags."""
    tags = []
    mapping = {
        "cpu": ("CPU", "blue"),
        "cuda": ("CUDA", "green"),
        "mps": ("MPS", "magenta"),
    }
    for key, (label, color) in mapping.items():
        if hw_dict.get(key, False):
            tags.append(f"[{color}]{label}[/{color}]")
    return " ".join(tags) if tags else "[dim]none[/dim]"
