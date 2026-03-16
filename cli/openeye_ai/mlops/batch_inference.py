"""Batch inference on large datasets with S3/GCS output (story 186)."""

from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import (
    BatchInferenceConfig,
    BatchInferenceJob,
    BatchInferenceProgress,
    BatchJobStatus,
    StorageBackend,
)

_BATCH_JOBS_PATH = OPENEYE_HOME / "batch_jobs.yaml"

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


def _load_jobs() -> list[dict]:
    return safe_load_yaml_list(_BATCH_JOBS_PATH)


def _save_jobs(jobs: list[dict]) -> None:
    atomic_save_yaml(_BATCH_JOBS_PATH, jobs)


def create_batch_job(config: BatchInferenceConfig) -> BatchInferenceJob:
    """Create a new batch inference job."""
    job = BatchInferenceJob(
        id=f"batch-{uuid.uuid4().hex[:8]}",
        config=config,
        status=BatchJobStatus.QUEUED,
    )
    jobs = _load_jobs()
    jobs.append(job.model_dump())
    _save_jobs(jobs)
    return job


def get_batch_job(job_id: str) -> BatchInferenceJob:
    """Get a batch job by ID."""
    jobs = _load_jobs()
    for j in jobs:
        if j["id"] == job_id:
            return BatchInferenceJob(**j)
    raise KeyError(f"Batch job '{job_id}' not found.")


def list_batch_jobs(model_key: Optional[str] = None) -> list[BatchInferenceJob]:
    """List batch jobs."""
    jobs = _load_jobs()
    result = [BatchInferenceJob(**j) for j in jobs]
    if model_key:
        result = [j for j in result if j.config.model_key == model_key]
    return result


def _list_local_images(input_path: str) -> list[Path]:
    """List all image files in a local directory."""
    d = Path(input_path)
    if not d.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_path}")
    return sorted(
        p for p in d.rglob("*") if p.is_file() and p.suffix.lower() in _IMAGE_EXTENSIONS
    )


def _list_s3_images(input_path: str) -> list[str]:
    """List image files in an S3 bucket/prefix."""
    import boto3

    # Parse s3://bucket/prefix
    parts = input_path.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    prefix = parts[1] if len(parts) > 1 else ""

    s3 = boto3.client("s3")
    paginator = s3.get_paginator("list_objects_v2")

    images = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if Path(key).suffix.lower() in _IMAGE_EXTENSIONS:
                images.append(f"s3://{bucket}/{key}")
    return images


def _list_gcs_images(input_path: str) -> list[str]:
    """List image files in a GCS bucket/prefix."""
    from google.cloud import storage

    parts = input_path.replace("gs://", "").split("/", 1)
    bucket_name = parts[0]
    prefix = parts[1] if len(parts) > 1 else ""

    client = storage.Client()
    bucket = client.bucket(bucket_name)

    images = []
    for blob in bucket.list_blobs(prefix=prefix):
        if Path(blob.name).suffix.lower() in _IMAGE_EXTENSIONS:
            images.append(f"gs://{bucket_name}/{blob.name}")
    return images


def _download_s3_image(uri: str):
    """Download an S3 image to a temp file and return a PIL Image."""
    import tempfile

    import boto3
    from PIL import Image

    parts = uri.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1]

    s3 = boto3.client("s3")
    with tempfile.NamedTemporaryFile(suffix=Path(key).suffix) as tmp:
        s3.download_file(bucket, key, tmp.name)
        return Image.open(tmp.name).convert("RGB").copy()


def _download_gcs_image(uri: str):
    """Download a GCS image to a temp file and return a PIL Image."""
    import tempfile

    from google.cloud import storage
    from PIL import Image

    parts = uri.replace("gs://", "").split("/", 1)
    bucket_name = parts[0]
    blob_name = parts[1]

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    with tempfile.NamedTemporaryFile(suffix=Path(blob_name).suffix) as tmp:
        blob.download_to_filename(tmp.name)
        return Image.open(tmp.name).convert("RGB").copy()


def _write_results_local(results: list[dict], output_path: str, fmt: str) -> str:
    """Write results to local file."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    if fmt == "jsonl":
        dest = out / "results.jsonl" if out.is_dir() else out
        with open(dest, "w", encoding="utf-8") as f:
            for r in results:
                f.write(json.dumps(r) + "\n")
        return str(dest)
    elif fmt == "csv":
        import csv

        dest = out / "results.csv" if out.is_dir() else out
        if results:
            keys = results[0].keys()
            with open(dest, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(results)
        return str(dest)
    else:
        raise ValueError(f"Unsupported output format: {fmt}")


def _format_results(results: list[dict], fmt: str) -> str:
    """Format results as JSONL or CSV string."""
    if fmt == "jsonl":
        return "\n".join(json.dumps(r) for r in results)
    elif fmt == "csv":
        import csv
        import io

        if not results:
            return ""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
        return output.getvalue()
    else:
        raise ValueError(f"Unsupported output format: {fmt}")


def _write_results_s3(results: list[dict], output_path: str, fmt: str) -> str:
    """Write results to S3."""
    import boto3

    parts = output_path.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1] if len(parts) > 1 else f"results.{fmt}"

    body = _format_results(results, fmt)

    s3 = boto3.client("s3")
    s3.put_object(Bucket=bucket, Key=key, Body=body.encode())
    return f"s3://{bucket}/{key}"


def _write_results_gcs(results: list[dict], output_path: str, fmt: str) -> str:
    """Write results to GCS."""
    from google.cloud import storage

    parts = output_path.replace("gs://", "").split("/", 1)
    bucket_name = parts[0]
    blob_name = parts[1] if len(parts) > 1 else f"results.{fmt}"

    body = _format_results(results, fmt)

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.upload_from_string(body)
    return f"gs://{bucket_name}/{blob_name}"


def run_batch_inference(
    job_id: str,
    adapter,
    *,
    progress_callback: Optional[Any] = None,
) -> BatchInferenceJob:
    """Execute a batch inference job.

    Loads images from the input path, runs inference with the given adapter,
    and writes results to the output path.
    """
    from PIL import Image

    jobs = _load_jobs()
    job_idx = -1
    job_data = None
    for i, j in enumerate(jobs):
        if j["id"] == job_id:
            job_data = j
            job_idx = i
            break

    if job_data is None:
        raise KeyError(f"Batch job '{job_id}' not found.")

    job = BatchInferenceJob(**job_data)
    config = job.config

    # Update status
    job.status = BatchJobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc).isoformat()
    jobs[job_idx] = job.model_dump()
    _save_jobs(jobs)

    try:
        # List images
        if config.storage_backend == StorageBackend.LOCAL:
            image_paths = _list_local_images(config.input_path)
            total = len(image_paths)
        elif config.storage_backend == StorageBackend.S3:
            image_paths = _list_s3_images(config.input_path)
            total = len(image_paths)
        elif config.storage_backend == StorageBackend.GCS:
            image_paths = _list_gcs_images(config.input_path)
            total = len(image_paths)
        else:
            raise ValueError(f"Unsupported storage backend: {config.storage_backend}")

        job.progress.total_images = total
        results = []
        start_time = time.monotonic()

        def _process_image(img_path):
            try:
                if config.storage_backend == StorageBackend.LOCAL:
                    img = Image.open(img_path).convert("RGB")
                elif config.storage_backend == StorageBackend.S3:
                    img = _download_s3_image(img_path)
                elif config.storage_backend == StorageBackend.GCS:
                    img = _download_gcs_image(img_path)
                else:
                    raise ValueError(f"Unsupported storage backend: {config.storage_backend}")

                result = adapter.predict(img)
                return {"source": str(img_path), "status": "ok", **result}
            except Exception as e:
                return {"source": str(img_path), "status": "error", "error": str(e)}

        # Process with thread pool for I/O parallelism
        with ThreadPoolExecutor(max_workers=config.max_workers) as pool:
            futures = {pool.submit(_process_image, p): p for p in image_paths}
            for future in as_completed(futures):
                result = future.result()
                results.append(result)

                if result.get("status") == "error":
                    job.progress.failed += 1
                job.progress.processed += 1

                elapsed = time.monotonic() - start_time
                job.progress.elapsed_seconds = elapsed
                job.progress.images_per_second = (
                    job.progress.processed / elapsed if elapsed > 0 else 0.0
                )
                remaining = total - job.progress.processed
                if job.progress.images_per_second > 0:
                    job.progress.estimated_remaining_seconds = (
                        remaining / job.progress.images_per_second
                    )

                if progress_callback:
                    progress_callback(job.progress)

        # Write results
        if config.storage_backend == StorageBackend.LOCAL:
            result_path = _write_results_local(results, config.output_path, config.output_format)
        elif config.storage_backend == StorageBackend.S3:
            result_path = _write_results_s3(results, config.output_path, config.output_format)
        elif config.storage_backend == StorageBackend.GCS:
            result_path = _write_results_gcs(results, config.output_path, config.output_format)
        else:
            result_path = config.output_path

        job.result_path = result_path
        job.status = BatchJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        job.status = BatchJobStatus.FAILED
        job.error = str(e)
        job.completed_at = datetime.now(timezone.utc).isoformat()

    jobs[job_idx] = job.model_dump()
    _save_jobs(jobs)
    return job
