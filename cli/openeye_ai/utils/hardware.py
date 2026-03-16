"""Hardware detection for model compatibility."""

from __future__ import annotations

import platform


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


def get_hardware_summary() -> dict[str, str]:
    """Return a summary of hardware for benchmark reproducibility.

    Keys: device (active compute), cpu, gpu (if applicable), platform.
    """
    hw = detect_hardware()

    # Determine active device
    if hw["cuda"]:
        device = "CUDA"
    elif hw["mps"]:
        device = "MPS"
    else:
        device = "CPU"

    summary: dict[str, str] = {
        "device": device,
        "cpu": _get_cpu_name(),
        "platform": f"{platform.system()} {platform.machine()}",
    }

    # GPU name if available
    if hw["cuda"]:
        try:
            import torch

            summary["gpu"] = torch.cuda.get_device_name(0)
        except Exception:
            summary["gpu"] = "CUDA (unknown)"
    elif hw["mps"]:
        summary["gpu"] = "Apple Metal (MPS)"

    return summary


def _get_cpu_name() -> str:
    """Best-effort CPU identification."""
    machine = platform.machine()
    system = platform.system()

    if system == "Darwin":
        try:
            import subprocess

            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            pass

    if system == "Linux":
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        return line.split(":", 1)[1].strip()
        except Exception:
            pass

    return f"{system} {machine}"


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
