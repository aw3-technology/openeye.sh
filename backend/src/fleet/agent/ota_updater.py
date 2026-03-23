"""OTA firmware updater – download, verify, apply."""

import hashlib
import ipaddress
import logging
import socket
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

from .bandwidth_limiter import BandwidthLimiter

logger = logging.getLogger(__name__)

# Allowed URL schemes for firmware downloads
_ALLOWED_SCHEMES = {"https"}

# Blocked IP ranges (link-local, metadata, private)
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / cloud metadata
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),        # Private
    ipaddress.ip_network("172.16.0.0/12"),     # Private
    ipaddress.ip_network("192.168.0.0/16"),    # Private
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("fd00::/8"),          # IPv6 ULA
]


def _validate_firmware_url(url: str) -> None:
    """Validate firmware URL to prevent SSRF attacks."""
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"Firmware URL must use HTTPS, got scheme: {parsed.scheme!r}")
    if not parsed.hostname:
        raise ValueError("Firmware URL has no hostname")

    # Resolve hostname and check against blocked IP ranges
    try:
        resolved = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise ValueError(f"Cannot resolve firmware URL hostname: {parsed.hostname}")

    for family, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        for network in _BLOCKED_NETWORKS:
            if ip in network:
                raise ValueError(f"Firmware URL resolves to blocked address: {ip}")


class OTAUpdater:
    def __init__(self, firmware_dir: str, bandwidth_limit_mbps: float = 0):
        self.firmware_dir = Path(firmware_dir)
        self.firmware_dir.mkdir(parents=True, exist_ok=True)
        self.limiter = BandwidthLimiter(rate_mbps=bandwidth_limit_mbps)

    @staticmethod
    def _validate_version(version: str) -> None:
        """Reject version strings that could escape the firmware directory."""
        if not version or ".." in version or "/" in version or "\\" in version:
            raise ValueError(f"Invalid firmware version string: {version!r}")

    def download_and_verify(
        self,
        url: str,
        version: str,
        expected_checksum: str,
        bandwidth_limit_mbps: Optional[float] = None,
    ) -> Path:
        """Download firmware, verify SHA-256, save to firmware_dir/version."""
        self._validate_version(version)
        limiter = (
            BandwidthLimiter(rate_mbps=bandwidth_limit_mbps)
            if bandwidth_limit_mbps is not None
            else self.limiter
        )

        _validate_firmware_url(url)

        logger.info("Downloading firmware %s from %s", version, url)
        with httpx.Client(timeout=300) as client:
            resp = client.get(url, follow_redirects=True)
            resp.raise_for_status()
            data = resp.content

        # Verify checksum
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected_checksum:
            raise ValueError(f"Firmware checksum mismatch: expected {expected_checksum}, got {actual}")

        # Rate-limit write (simulates throttled download for real streaming)
        dest = self.firmware_dir / version
        dest.mkdir(parents=True, exist_ok=True)
        firmware_file = dest / "firmware.bin"

        with firmware_file.open("wb") as f:
            for chunk in limiter.throttled_read(data):
                f.write(chunk)

        logger.info("Firmware %s downloaded and verified (%d bytes)", version, len(data))
        return dest

    def apply(self, version: str) -> bool:
        """Apply firmware update. In production this would call platform-specific update APIs."""
        self._validate_version(version)
        fw_path = self.firmware_dir / version / "firmware.bin"
        if not fw_path.exists():
            logger.error("Firmware file not found: %s", fw_path)
            return False
        logger.info("Applying firmware update %s", version)
        # Platform-specific update logic would go here
        # (e.g., writing to boot partition, calling system update API)
        return True
