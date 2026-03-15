"""Tests for openeye_ai.utils.checksum."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from openeye_ai.utils.checksum import compute_checksum, verify_checksum

KNOWN_CONTENT = b"hello world"
KNOWN_SHA256 = hashlib.sha256(KNOWN_CONTENT).hexdigest()
KNOWN_MD5 = hashlib.md5(KNOWN_CONTENT).hexdigest()


@pytest.fixture()
def sample_file(tmp_path: Path) -> Path:
    """Write known content to a temp file and return its path."""
    p = tmp_path / "model.bin"
    p.write_bytes(KNOWN_CONTENT)
    return p


# ── compute_checksum ─────────────────────────────────────────────────


def test_compute_sha256(sample_file: Path):
    assert compute_checksum(sample_file) == KNOWN_SHA256


def test_compute_sha256_explicit(sample_file: Path):
    assert compute_checksum(sample_file, algo="sha256") == KNOWN_SHA256


def test_compute_md5(sample_file: Path):
    assert compute_checksum(sample_file, algo="md5") == KNOWN_MD5


def test_compute_unsupported_algorithm(sample_file: Path):
    with pytest.raises(ValueError, match="Unsupported"):
        compute_checksum(sample_file, algo="crc32")


# ── verify_checksum ──────────────────────────────────────────────────


def test_verify_match(tmp_path: Path):
    (tmp_path / "model.bin").write_bytes(KNOWN_CONTENT)
    expected = {"algorithm": "sha256", "value": KNOWN_SHA256}
    assert verify_checksum(tmp_path, "model.bin", expected) is True


def test_verify_mismatch(tmp_path: Path):
    (tmp_path / "model.bin").write_bytes(KNOWN_CONTENT)
    expected = {"algorithm": "sha256", "value": "0" * 64}
    assert verify_checksum(tmp_path, "model.bin", expected) is False


def test_verify_file_not_found(tmp_path: Path):
    expected = {"algorithm": "sha256", "value": KNOWN_SHA256}
    assert verify_checksum(tmp_path, "missing.bin", expected) is False


def test_verify_empty_expected_value(tmp_path: Path):
    (tmp_path / "model.bin").write_bytes(KNOWN_CONTENT)
    expected = {"algorithm": "sha256", "value": ""}
    assert verify_checksum(tmp_path, "model.bin", expected) is True


def test_verify_no_value_key(tmp_path: Path):
    (tmp_path / "model.bin").write_bytes(KNOWN_CONTENT)
    expected = {"algorithm": "sha256"}
    assert verify_checksum(tmp_path, "model.bin", expected) is True


def test_verify_md5(tmp_path: Path):
    (tmp_path / "model.bin").write_bytes(KNOWN_CONTENT)
    expected = {"algorithm": "md5", "value": KNOWN_MD5}
    assert verify_checksum(tmp_path, "model.bin", expected) is True
