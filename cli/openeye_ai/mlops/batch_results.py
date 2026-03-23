"""Batch inference result handling (story 186)."""

from __future__ import annotations

import json
from pathlib import Path


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
            # Compute the union of all keys across results and flatten nested values
            all_keys: set[str] = set()
            for r in results:
                all_keys.update(r.keys())
            keys = sorted(all_keys)
            with open(dest, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
                writer.writeheader()
                for r in results:
                    flat = {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in r.items()}
                    writer.writerow(flat)
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
