"""Local model cache with current + previous version for instant rollback."""

import hashlib
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ModelCache:
    """Manages local model files. Keeps current + previous version for <60s rollback."""

    def __init__(self, cache_dir: str, max_versions: int = 2):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_versions = max_versions
        self._current_version: Optional[str] = None
        self._previous_version: Optional[str] = None
        self._restore_versions()

    @property
    def current_version(self) -> Optional[str]:
        return self._current_version

    @property
    def current_path(self) -> Optional[Path]:
        if self._current_version:
            return self.cache_dir / self._current_version
        return None

    @property
    def previous_path(self) -> Optional[Path]:
        if self._previous_version:
            return self.cache_dir / self._previous_version
        return None

    @staticmethod
    def _validate_version(version: str) -> None:
        """Reject version strings that could escape the cache directory."""
        if not version or ".." in version or "/" in version or "\\" in version:
            raise ValueError(f"Invalid version string: {version!r}")

    def store(self, version: str, data: bytes, checksum: Optional[str] = None) -> Path:
        """Store a model version. Verifies checksum if provided."""
        self._validate_version(version)
        if checksum:
            actual = hashlib.sha256(data).hexdigest()
            if actual != checksum:
                raise ValueError(f"Checksum mismatch: expected {checksum}, got {actual}")

        dest = self.cache_dir / version
        dest.mkdir(parents=True, exist_ok=True)
        model_file = dest / "model.bin"
        model_file.write_bytes(data)

        # Rotate versions
        self._previous_version = self._current_version
        self._current_version = version
        self._cleanup()

        logger.info("Stored model version %s (%d bytes)", version, len(data))
        return dest

    def rollback(self) -> Optional[str]:
        """Swap to previous version. Returns the version string or None if unavailable."""
        if not self._previous_version or not self.previous_path or not self.previous_path.exists():
            logger.warning("No previous version available for rollback")
            return None

        old_current = self._current_version
        self._current_version = self._previous_version
        self._previous_version = old_current
        logger.info("Rolled back to version %s", self._current_version)
        return self._current_version

    def has_version(self, version: str) -> bool:
        self._validate_version(version)
        return (self.cache_dir / version).exists()

    def get_path(self, version: str) -> Optional[Path]:
        self._validate_version(version)
        p = self.cache_dir / version
        return p if p.exists() else None

    def _restore_versions(self) -> None:
        """Restore current/previous version from disk by modification time."""
        version_dirs = sorted(
            (d for d in self.cache_dir.iterdir() if d.is_dir() and (d / "model.bin").exists()),
            key=lambda d: d.stat().st_mtime,
            reverse=True,
        )
        if version_dirs:
            self._current_version = version_dirs[0].name
            logger.info("Restored current model version from disk: %s", self._current_version)
        if len(version_dirs) > 1:
            self._previous_version = version_dirs[1].name
            logger.info("Restored previous model version from disk: %s", self._previous_version)

    def _cleanup(self) -> None:
        """Remove versions beyond max_versions."""
        keep = {self._current_version, self._previous_version} - {None}
        for entry in self.cache_dir.iterdir():
            if entry.is_dir() and entry.name not in keep:
                shutil.rmtree(entry)
                logger.debug("Removed cached version %s", entry.name)
