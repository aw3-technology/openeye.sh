"""Batch inference commands for the MLOps CLI."""

from __future__ import annotations

import typer
from rich import print as rprint


def mlops_batch_create(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    input_path: str = typer.Option(..., "--input", "-i", help="Input dataset path (local dir, s3://, gs://)"),
    output_path: str = typer.Option("", "--output", "-o", help="Output path for results (default: auto)"),
    version: str = typer.Option("latest", "--version", "-v", help="Model version (default: latest)"),
    batch_size: int = typer.Option(32, "--batch-size", help="Batch size"),
    workers: int = typer.Option(4, "--workers", help="Number of workers"),
    output_format: str = typer.Option("jsonl", "--format", help="Output format: jsonl, csv"),
) -> None:
    """Create a batch inference job on a dataset."""
    from openeye_ai.mlops.batch_inference import create_batch_job
    from openeye_ai.mlops.schemas import BatchInferenceConfig, StorageBackend

    backend = StorageBackend.LOCAL
    if input_path.startswith("s3://"):
        backend = StorageBackend.S3
    elif input_path.startswith("gs://"):
        backend = StorageBackend.GCS

    resolved_output = output_path or f"{input_path.rstrip('/')}_results.{output_format}"

    config = BatchInferenceConfig(
        name=f"batch-{model}-{version}",
        model_key=model,
        model_version=version,
        input_path=input_path,
        output_path=resolved_output,
        storage_backend=backend,
        batch_size=batch_size,
        max_workers=workers,
        output_format=output_format,
    )
    job = create_batch_job(config)
    rprint(f"[green]Batch job created: {job.id}[/green]")
    rprint(f"  Model: {model} v{version} | Input: {input_path}")
    rprint(f"  Output: {resolved_output}")
