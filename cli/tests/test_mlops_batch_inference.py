"""Tests for openeye_ai.mlops.batch_inference — local helpers, format results."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


class TestBatchInference:
    def test_list_local_images(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _list_local_images

        (tmp_path / "a.jpg").write_bytes(b"\xff")
        (tmp_path / "b.png").write_bytes(b"\xff")
        (tmp_path / "c.txt").write_text("nope")
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "d.jpeg").write_bytes(b"\xff")

        images = _list_local_images(str(tmp_path))
        names = [p.name for p in images]
        assert "a.jpg" in names
        assert "b.png" in names
        assert "d.jpeg" in names
        assert "c.txt" not in names

    def test_list_local_images_missing_dir(self):
        from openeye_ai.mlops.batch_inference import _list_local_images

        with pytest.raises(FileNotFoundError):
            _list_local_images("/nonexistent/dir")

    def test_format_results_jsonl(self):
        from openeye_ai.mlops.batch_inference import _format_results

        results = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
        out = _format_results(results, "jsonl")
        lines = out.strip().split("\n")
        assert len(lines) == 2
        assert json.loads(lines[0]) == {"a": 1, "b": 2}

    def test_format_results_csv(self):
        from openeye_ai.mlops.batch_inference import _format_results

        results = [{"name": "x", "val": 1}, {"name": "y", "val": 2}]
        out = _format_results(results, "csv")
        assert "name" in out
        assert "x" in out

    def test_format_results_csv_empty(self):
        from openeye_ai.mlops.batch_inference import _format_results

        assert _format_results([], "csv") == ""

    def test_format_results_unsupported(self):
        from openeye_ai.mlops.batch_inference import _format_results

        with pytest.raises(ValueError, match="Unsupported"):
            _format_results([], "parquet")

    def test_write_results_local_jsonl(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _write_results_local

        results = [{"source": "a.jpg", "label": "cat"}]
        dest = _write_results_local(results, str(tmp_path / "out.jsonl"), "jsonl")
        content = Path(dest).read_text()
        assert "cat" in content

    def test_write_results_local_csv(self, tmp_path):
        from openeye_ai.mlops.batch_inference import _write_results_local

        results = [{"source": "a.jpg", "label": "dog"}]
        dest = _write_results_local(results, str(tmp_path / "out.csv"), "csv")
        content = Path(dest).read_text()
        assert "source" in content
        assert "dog" in content

    def test_create_and_get_batch_job(self):
        from openeye_ai.mlops.batch_inference import create_batch_job, get_batch_job
        from openeye_ai.mlops.schemas import BatchInferenceConfig

        config = BatchInferenceConfig(
            name="job1", model_key="m", model_version="1.0",
            input_path="/data/images", output_path="/data/results",
        )
        job = create_batch_job(config)
        assert job.id.startswith("batch-")

        fetched = get_batch_job(job.id)
        assert fetched.config.name == "job1"

    def test_get_batch_job_not_found(self):
        from openeye_ai.mlops.batch_inference import get_batch_job

        with pytest.raises(KeyError):
            get_batch_job("batch-nonexistent")

    def test_list_batch_jobs(self):
        from openeye_ai.mlops.batch_inference import create_batch_job, list_batch_jobs
        from openeye_ai.mlops.schemas import BatchInferenceConfig

        create_batch_job(BatchInferenceConfig(
            name="j1", model_key="m1", model_version="1.0",
            input_path="/data1", output_path="/out1",
        ))
        create_batch_job(BatchInferenceConfig(
            name="j2", model_key="m2", model_version="1.0",
            input_path="/data2", output_path="/out2",
        ))
        assert len(list_batch_jobs()) == 2
        assert len(list_batch_jobs(model_key="m1")) == 1
        assert len(list_batch_jobs(model_key="nonexistent")) == 0

    def test_list_local_images_empty_dir(self, tmp_path):
        """Empty directory returns no images."""
        from openeye_ai.mlops.batch_inference import _list_local_images

        images = _list_local_images(str(tmp_path))
        assert images == []

    def test_format_results_jsonl_empty(self):
        from openeye_ai.mlops.batch_inference import _format_results

        assert _format_results([], "jsonl") == ""
