"""Tests for ``openeye docs`` — the reference is generated from the Typer app."""

from __future__ import annotations

import json

from openeye_ai.cli import app
from openeye_ai.commands.docs import build_reference, collect_commands
from typer.testing import CliRunner

runner = CliRunner()


def _by_command() -> dict[str, dict]:
    return {c["command"]: c for c in collect_commands()}


def test_docs_lists_real_signatures():
    cmds = _by_command()
    # mlops promote takes options, not positionals
    promote = cmds["openeye mlops promote"]
    assert "--model <MODEL>" in promote["usage"]
    assert "--version <VERSION>" in promote["usage"]
    assert promote["arguments"] == []
    approve = cmds["openeye mlops approve-promotion"]
    assert "--model <MODEL>" in approve["usage"]
    # positional arguments are rendered as <arg>
    assert cmds["openeye config set"]["usage"] == "openeye config set <key> <value>"
    assert cmds["openeye api depth"]["usage"] == "openeye api depth <image>"


def test_docs_covers_every_group():
    groups = {c["group"] for c in collect_commands()}
    assert {None, "config", "fleet", "mlops", "govern", "agent", "api"} <= groups


def test_docs_markdown_contains_every_command():
    ref = build_reference()
    for c in collect_commands():
        assert f"`{c['usage']}`" in ref.replace("\\|", "|")


def test_docs_cli_plain_and_json():
    result = runner.invoke(app, ["docs"])
    assert result.exit_code == 0
    assert "openeye mlops promote --model <MODEL>" in result.stdout
    # [<arg>] must survive (no Rich markup stripping)
    assert "openeye run <model> [<image>]" in result.stdout

    result = runner.invoke(app, ["docs", "--json"])
    assert result.exit_code == 0
    data = json.loads(result.stdout)
    assert "reference" in data
    assert any(c["command"] == "openeye api usage" for c in data["commands"])
