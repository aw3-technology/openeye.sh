"""System resource monitoring using psutil (and pynvml for GPU)."""

import logging
from typing import Optional

from ..models import ResourceUsage

logger = logging.getLogger(__name__)

try:
    import psutil
except ImportError:
    psutil = None  # type: ignore
    logger.warning("psutil not installed – resource monitoring disabled")

try:
    import pynvml

    pynvml.nvmlInit()
    _GPU_AVAILABLE = True
except Exception:
    _GPU_AVAILABLE = False


class ResourceMonitor:
    def collect(self) -> ResourceUsage:
        if psutil is None:
            return ResourceUsage()

        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        usage = ResourceUsage(
            cpu_percent=cpu_percent,
            memory_percent=mem.percent,
            memory_used_gb=round(mem.used / (1024**3), 2),
            disk_percent=disk.percent,
            disk_used_gb=round(disk.used / (1024**3), 2),
        )

        # CPU temperature (best-effort)
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                first_key = next(iter(temps))
                if temps[first_key]:
                    usage.cpu_temp_celsius = temps[first_key][0].current
        except Exception as exc:
            logging.debug("Failed to read CPU temperature: %s", exc)

        # GPU metrics
        if _GPU_AVAILABLE:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                usage.gpu_percent = util.gpu
                usage.gpu_memory_percent = round(mem_info.used / mem_info.total * 100, 1) if mem_info.total else 0
                usage.gpu_temp_celsius = temp
            except Exception as exc:
                logger.debug("GPU metrics unavailable: %s", exc)

        return usage
