"""Tests for openeye_ai.mlops.lineage."""

from __future__ import annotations

from unittest.mock import patch

import pytest


class TestLineage:
    def test_record_and_get_lineage(self):
        from openeye_ai.mlops.lineage import get_lineage, record_lineage

        lineage = record_lineage(
            "model-a", "1.0.0",
            dataset="imagenet",
            code_commit="abc123",
            auto_detect_git=False,
        )
        assert lineage.dataset == "imagenet"
        assert lineage.code_commit == "abc123"

        fetched = get_lineage("model-a", "1.0.0")
        assert fetched.dataset == "imagenet"

    def test_get_lineage_not_found(self):
        from openeye_ai.mlops.lineage import get_lineage

        with pytest.raises(KeyError):
            get_lineage("nope", "1.0.0")

    def test_record_lineage_replaces_existing(self):
        from openeye_ai.mlops.lineage import get_lineage, list_lineage, record_lineage

        record_lineage("m", "1.0", dataset="d1", code_commit="c1", auto_detect_git=False)
        record_lineage("m", "1.0", dataset="d2", code_commit="c2", auto_detect_git=False)
        assert len(list_lineage(model_key="m")) == 1
        assert get_lineage("m", "1.0").dataset == "d2"

    def test_list_lineage(self):
        from openeye_ai.mlops.lineage import list_lineage, record_lineage

        record_lineage("m1", "1.0", dataset="d", code_commit="c", auto_detect_git=False)
        record_lineage("m2", "1.0", dataset="d", code_commit="c", auto_detect_git=False)
        assert len(list_lineage()) == 2
        assert len(list_lineage(model_key="m1")) == 1

    def test_lineage_chain(self):
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        record_lineage("m", "1.0", dataset="d1", code_commit="c1", auto_detect_git=False)
        record_lineage("m", "2.0", dataset="d2", code_commit="c2", auto_detect_git=False, parent_model="1.0")
        record_lineage("m", "3.0", dataset="d3", code_commit="c3", auto_detect_git=False, parent_model="2.0")

        chain = get_lineage_chain("m", "3.0")
        assert len(chain) == 3
        assert chain[0].version == "3.0"
        assert chain[1].version == "2.0"
        assert chain[2].version == "1.0"

    def test_lineage_chain_cycle_protection(self):
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        # Create a cycle: 1.0 -> 2.0 -> 1.0
        record_lineage("cyc", "1.0", dataset="d", code_commit="c", auto_detect_git=False, parent_model="2.0")
        record_lineage("cyc", "2.0", dataset="d", code_commit="c", auto_detect_git=False, parent_model="1.0")

        chain = get_lineage_chain("cyc", "1.0")
        # Should terminate without infinite loop
        assert len(chain) == 2

    @patch("openeye_ai.mlops.lineage.subprocess.check_output")
    def test_get_current_git_info(self, mock_check_output):
        from openeye_ai.mlops.lineage import _get_current_git_info

        def _fake_git(args, **kw):
            if "rev-parse" in args and "--abbrev-ref" in args:
                return "main\n"
            if "rev-parse" in args:
                return "abc123def\n"
            if "get-url" in args:
                return "https://github.com/example/repo.git\n"
            return ""

        mock_check_output.side_effect = _fake_git

        info = _get_current_git_info()
        assert info["commit"] == "abc123def"
        assert info["branch"] == "main"
        assert info["repo"] == "https://github.com/example/repo.git"

    @patch("openeye_ai.mlops.lineage.subprocess.check_output")
    def test_get_current_git_info_no_git(self, mock_check_output):
        """When git is not available, all fields default to empty strings."""
        from openeye_ai.mlops.lineage import _get_current_git_info

        mock_check_output.side_effect = FileNotFoundError("git not found")
        info = _get_current_git_info()
        assert info["commit"] == ""
        assert info["branch"] == ""
        assert info["repo"] == ""

    def test_lineage_chain_single_version(self):
        """Chain with no parent should contain just the single version."""
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        record_lineage("solo", "1.0", dataset="d", code_commit="c", auto_detect_git=False)
        chain = get_lineage_chain("solo", "1.0")
        assert len(chain) == 1
        assert chain[0].version == "1.0"

    def test_lineage_chain_missing_parent(self):
        """Chain should stop when a parent_model version doesn't exist."""
        from openeye_ai.mlops.lineage import get_lineage_chain, record_lineage

        record_lineage("gap", "2.0", dataset="d", code_commit="c", auto_detect_git=False, parent_model="1.0")
        # "1.0" was never recorded
        chain = get_lineage_chain("gap", "2.0")
        assert len(chain) == 1
        assert chain[0].version == "2.0"
