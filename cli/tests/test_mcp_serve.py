"""MCP ``openeye_serve``: output goes to a log file, not undrained PIPEs."""

from __future__ import annotations

import asyncio

import pytest

pytest.importorskip("mcp")

from openeye_ai.mcp import server  # noqa: E402


class _FakeProc:
    def __init__(self, exits: bool, returncode: int = 1):
        self.pid = 4242
        self._exits = exits
        self.returncode = returncode if exits else None

    async def wait(self):
        if self._exits:
            return self.returncode
        await asyncio.sleep(3600)


@pytest.fixture()
def openeye_home(tmp_path, monkeypatch):
    from openeye_ai import config

    monkeypatch.setattr(config, "OPENEYE_HOME", tmp_path / ".openeye")
    return tmp_path / ".openeye"


def _patch_spawn(monkeypatch, proc: _FakeProc, write: bytes = b""):
    calls: list[dict] = []

    async def fake_exec(*args, **kwargs):
        calls.append({"args": args, **kwargs})
        if write:
            kwargs["stdout"].write(write)
            kwargs["stdout"].flush()
        return proc

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    return calls


def test_serve_logs_to_file_and_reports_path(monkeypatch, openeye_home):
    calls = _patch_spawn(monkeypatch, _FakeProc(exits=False))
    real_wait_for = asyncio.wait_for

    async def quick_wait_for(aw, timeout):
        return await real_wait_for(aw, timeout=0.01)

    monkeypatch.setattr(asyncio, "wait_for", quick_wait_for)

    out = asyncio.run(server.openeye_serve("yolov8", port=8123))

    log_path = openeye_home / "logs" / "serve-8123.log"
    assert "Server started on port 8123 (PID 4242)" in out
    assert str(log_path) in out
    assert log_path.exists()
    kw = calls[0]
    assert kw["args"][1:] == ("serve", "yolov8", "--port", "8123")
    assert kw["stdout"] is not asyncio.subprocess.PIPE
    assert kw["stderr"] == asyncio.subprocess.STDOUT
    assert kw["stdin"] == asyncio.subprocess.DEVNULL


def test_serve_early_exit_reads_error_from_log(monkeypatch, openeye_home):
    _patch_spawn(
        monkeypatch,
        _FakeProc(exits=True, returncode=2),
        write=b"Error: model 'nope' not found\n",
    )

    out = asyncio.run(server.openeye_serve("nope", port=8124))

    assert "Server exited immediately (code 2)" in out
    assert "model 'nope' not found" in out
    assert str(openeye_home / "logs" / "serve-8124.log") in out
