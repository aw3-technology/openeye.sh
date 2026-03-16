"""Deployment commands — registry, promotion, A/B testing, shadow, export."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console

deploy_app = typer.Typer()


# ── Upload + Register ─────────────────────────────────────────────────


@deploy_app.command("upload")
def mlops_upload(
    file: Path = typer.Argument(help="Path to model file (ONNX, TorchScript, SafeTensors)"),
    name: str = typer.Option(..., "--name", "-n", help="Human-readable model name"),
    key: str = typer.Option(..., "--key", "-k", help="Registry key (slug)"),
    format: str = typer.Option(..., "--format", "-f", help="Model format: onnx, torchscript, safetensors"),
    task: str = typer.Option("detection", "--task", "-t", help="Model task"),
    author: str = typer.Option("", "--author", help="Author name"),
    description: str = typer.Option("", "--description", "-d", help="Model description"),
    adapter: str = typer.Option("onnx_generic", "--adapter", help="Adapter key"),
) -> None:
    """Upload a custom-trained model and register it in the enterprise registry."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    try:
        fmt = ModelFormat(format)
    except ValueError:
        rprint(f"[red]Invalid format '{format}'. Use: onnx, torchscript, safetensors[/red]")
        raise typer.Exit(code=1)

    try:
        req = ModelUploadRequest(
            name=name, key=key, format=fmt, task=task,
            description=description, author=author,
            file_path=str(file), adapter=adapter,
        )
        version = upload_and_register(req)
        rprint(f"[green]Registered '{name}' as '{key}' v{version.version}[/green]")
        rprint(f"  Format: {version.format.value} | Size: {version.file_size_mb:.1f} MB")
    except (FileNotFoundError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── List Registry + Versions ──────────────────────────────────────────


@deploy_app.command("registry")
def mlops_registry() -> None:
    """List all models in the enterprise registry with version history."""
    from openeye_ai.mlops.model_registry import list_registered_models

    models = list_registered_models()
    if not models:
        rprint("[dim]No models in enterprise registry. Use 'openeye mlops upload' to add one.[/dim]")
        return

    table = Table(title="Enterprise Model Registry")
    table.add_column("Key", style="cyan")
    table.add_column("Name", style="bold")
    table.add_column("Task", style="magenta")
    table.add_column("Versions", justify="right")
    table.add_column("Latest", style="green")
    table.add_column("Production", style="yellow")

    for m in models:
        latest = m.latest_version
        prod = m.production_version
        table.add_row(
            m.key,
            m.name,
            m.task,
            str(len(m.versions)),
            latest.version if latest else "—",
            prod.version if prod else "—",
        )
    console.print(table)


@deploy_app.command("versions")
def mlops_versions(
    model_key: str = typer.Argument(help="Model registry key"),
) -> None:
    """List all versions of a model with metadata."""
    from openeye_ai.mlops.model_registry import list_versions

    try:
        versions = list_versions(model_key)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    table = Table(title=f"Versions: {model_key}")
    table.add_column("Version", style="cyan")
    table.add_column("Stage", style="magenta")
    table.add_column("Format")
    table.add_column("Size", justify="right")
    table.add_column("Author")
    table.add_column("Dataset")
    table.add_column("Accuracy", justify="right")
    table.add_column("Created")

    for v in versions:
        acc = f"{v.training_metrics.accuracy:.1%}" if v.training_metrics.accuracy else "—"
        table.add_row(
            v.version, v.stage.value, v.format.value,
            f"{v.file_size_mb:.1f} MB", v.author or "—",
            v.training_dataset or "—", acc,
            v.created_at[:10],
        )
    console.print(table)


# ── Promote / Approve / Reject ────────────────────────────────────────


@deploy_app.command("promote")
def mlops_promote(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Version to promote"),
    stage: str = typer.Argument(help="Target stage: staging or production"),
    requester: str = typer.Option("cli-user", "--requester", help="Requester name"),
    reason: str = typer.Option("", "--reason", help="Reason for promotion"),
) -> None:
    """Promote a model version to a new stage (dev -> staging -> production)."""
    from openeye_ai.mlops.lifecycle import request_promotion
    from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

    try:
        target = ModelStage(stage)
    except ValueError:
        rprint(f"[red]Invalid stage '{stage}'. Use: staging, production, archived[/red]")
        raise typer.Exit(code=1)

    try:
        req = PromotionRequest(
            model_key=model_key, version=version,
            target_stage=target, requester=requester, reason=reason,
        )
        record = request_promotion(req)
        rprint(f"[green]Promotion {record.from_stage.value} -> {record.to_stage.value}: {record.status.value}[/green]")
        if record.approver:
            rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("approve")
def mlops_approve(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Approver name"),
) -> None:
    """Approve a pending model promotion."""
    from openeye_ai.mlops.lifecycle import approve_promotion

    try:
        record = approve_promotion(model_key, version, approver)
        rprint(f"[green]Promotion approved:[/green] {record.from_stage.value} -> {record.to_stage.value}")
        rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("reject")
def mlops_reject(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Reviewer name"),
    reason: str = typer.Option("", "--reason", "-r", help="Rejection reason"),
) -> None:
    """Reject a pending model promotion."""
    from openeye_ai.mlops.lifecycle import reject_promotion

    try:
        record = reject_promotion(model_key, version, approver, reason)
        rprint(f"[yellow]Promotion rejected:[/yellow] {record.from_stage.value} -> {record.to_stage.value}")
        if record.reason:
            rprint(f"  Reason: {record.reason}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── A/B Test ──────────────────────────────────────────────────────────


@deploy_app.command("ab-test")
def mlops_ab_test(
    model_key: str = typer.Argument(help="Model key"),
    version_a: str = typer.Option(..., "--a", help="Control version"),
    version_b: str = typer.Option(..., "--b", help="Challenger version"),
    name: str = typer.Option("", "--name", help="Test name"),
    split: float = typer.Option(0.5, "--split", help="Traffic split to version B (0-1)"),
    max_samples: Optional[int] = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Create an A/B test between two model versions."""
    from openeye_ai.mlops.ab_testing import create_ab_test
    from openeye_ai.mlops.schemas import ABTestConfig

    config = ABTestConfig(
        name=name or f"{model_key} A/B: {version_a} vs {version_b}",
        model_key=model_key,
        version_a=version_a,
        version_b=version_b,
        traffic_split=split,
        max_samples=max_samples,
    )
    test = create_ab_test(config)
    rprint(f"[green]A/B test created: {test.id}[/green]")
    rprint(f"  {version_a} vs {version_b} | Split: {split:.0%} to B")


@deploy_app.command("ab-status")
def mlops_ab_status(model_key: Optional[str] = typer.Argument(None, help="Filter by model key")) -> None:
    """Show status of A/B tests."""
    from openeye_ai.mlops.ab_testing import list_ab_tests

    tests = list_ab_tests(model_key)
    if not tests:
        rprint("[dim]No A/B tests found.[/dim]")
        return

    table = Table(title="A/B Tests")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("A (control)")
    table.add_column("B (challenger)")
    table.add_column("Status", style="magenta")
    table.add_column("A Acc", justify="right")
    table.add_column("B Acc", justify="right")
    table.add_column("A Lat", justify="right")
    table.add_column("B Lat", justify="right")
    table.add_column("Winner", style="green")

    for t in tests:
        table.add_row(
            t.id, t.config.model_key,
            t.config.version_a, t.config.version_b,
            t.status.value,
            f"{t.metrics_a.mean_accuracy:.1%}" if t.metrics_a.samples else "—",
            f"{t.metrics_b.mean_accuracy:.1%}" if t.metrics_b.samples else "—",
            f"{t.metrics_a.mean_latency_ms:.1f}ms" if t.metrics_a.samples else "—",
            f"{t.metrics_b.mean_latency_ms:.1f}ms" if t.metrics_b.samples else "—",
            t.winner or "—",
        )
    console.print(table)


# ── Shadow Mode ───────────────────────────────────────────────────────


@deploy_app.command("shadow")
def mlops_shadow(
    model_key: str = typer.Argument(help="Model key"),
    prod_version: str = typer.Option(..., "--prod", help="Production version"),
    shadow_version: str = typer.Option(..., "--shadow", help="Shadow version"),
    sample_rate: float = typer.Option(1.0, "--sample-rate", help="Fraction of traffic (0-1)"),
    max_samples: Optional[int] = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Set up shadow mode for a new model alongside production."""
    from openeye_ai.mlops.shadow_mode import create_shadow_deployment
    from openeye_ai.mlops.schemas import ShadowDeploymentConfig

    config = ShadowDeploymentConfig(
        name=f"shadow-{model_key}-{shadow_version}",
        model_key=model_key,
        production_version=prod_version,
        shadow_version=shadow_version,
        sample_rate=sample_rate,
        max_samples=max_samples,
    )
    dep = create_shadow_deployment(config)
    rprint(f"[green]Shadow deployment created: {dep.id}[/green]")
    rprint(f"  Production: {prod_version} | Shadow: {shadow_version} | Rate: {sample_rate:.0%}")


@deploy_app.command("shadow-status")
def mlops_shadow_status(model_key: Optional[str] = typer.Argument(None, help="Filter by model")) -> None:
    """Show shadow deployment status and comparison metrics."""
    from openeye_ai.mlops.shadow_mode import list_shadow_deployments

    deps = list_shadow_deployments(model_key)
    if not deps:
        rprint("[dim]No shadow deployments found.[/dim]")
        return

    table = Table(title="Shadow Deployments")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("Production")
    table.add_column("Shadow")
    table.add_column("Status", style="magenta")
    table.add_column("Samples", justify="right")
    table.add_column("Agreement", justify="right")
    table.add_column("Prod Lat", justify="right")
    table.add_column("Shadow Lat", justify="right")

    for d in deps:
        c = d.comparison
        table.add_row(
            d.id, d.config.model_key,
            d.config.production_version, d.config.shadow_version,
            d.status.value, str(c.total_samples),
            f"{c.agreement_rate:.1%}" if c.total_samples else "—",
            f"{c.production_mean_latency_ms:.1f}ms" if c.total_samples else "—",
            f"{c.shadow_mean_latency_ms:.1f}ms" if c.total_samples else "—",
        )
    console.print(table)


# ── Export ────────────────────────────────────────────────────────────


@deploy_app.command("export")
def mlops_export(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    target_format: str = typer.Argument(help="Export format: onnx, tensorrt, coreml"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output path"),
    quantize: bool = typer.Option(False, "--quantize", help="Apply INT8 quantization"),
) -> None:
    """Export a model to ONNX, TensorRT, or CoreML format for edge deployment."""
    from openeye_ai.mlops.export import export_model
    from openeye_ai.mlops.schemas import ExportFormat, ExportRequest

    try:
        fmt = ExportFormat(target_format)
    except ValueError:
        rprint(f"[red]Invalid format '{target_format}'. Use: onnx, tensorrt, coreml[/red]")
        raise typer.Exit(code=1)

    request = ExportRequest(
        model_key=model_key,
        model_version=version,
        target_format=fmt,
        output_path=str(output) if output else None,
        quantize=quantize,
    )

    try:
        with console.status(f"Exporting {model_key} v{version} to {target_format}..."):
            result = export_model(request)
        rprint(f"[green]Exported to: {result.output_path}[/green]")
        rprint(f"  Size: {result.output_size_mb:.1f} MB | Duration: {result.export_duration_seconds:.1f}s")
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("exports")
def mlops_exports(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List previous model exports."""
    from openeye_ai.mlops.export import list_exports

    exports = list_exports(model_key)
    if not exports:
        rprint("[dim]No exports found.[/dim]")
        return

    table = Table(title="Model Exports")
    table.add_column("Model", style="cyan")
    table.add_column("Version")
    table.add_column("Format")
    table.add_column("Target", style="magenta")
    table.add_column("Size", justify="right")
    table.add_column("Quantized")
    table.add_column("Duration", justify="right")
    table.add_column("Output Path")

    for e in exports:
        table.add_row(
            e.model_key,
            e.model_version,
            e.source_format.value,
            e.target_format.value,
            f"{e.output_size_mb:.1f} MB",
            "[green]Yes[/green]" if e.quantized else "No",
            f"{e.export_duration_seconds:.1f}s",
            e.output_path,
        )
    console.print(table)


# ── Lineage ───────────────────────────────────────────────────────────


@deploy_app.command("lineage")
def mlops_lineage(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
) -> None:
    """Show lineage (provenance) for a model version."""
    from openeye_ai.mlops.lineage import get_lineage_chain

    try:
        chain = get_lineage_chain(model_key, version)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if not chain:
        rprint(f"[yellow]No lineage recorded for {model_key} v{version}.[/yellow]")
        return

    for i, lineage in enumerate(chain):
        indent = "    " * i
        rprint(f"{indent}[cyan]{lineage.model_key}[/cyan] v{lineage.version}")
        rprint(f"{indent}    Dataset: {lineage.dataset} ({lineage.dataset_size or '?'} samples)")
        rprint(f"{indent}    Commit: {lineage.code_commit[:8] if lineage.code_commit else '—'}")
        rprint(f"{indent}    Framework: {lineage.training_framework or '—'}")
        if lineage.hyperparameters:
            hp = ", ".join(f"{k}={v}" for k, v in lineage.hyperparameters.items())
            rprint(f"{indent}    Hyperparams: {hp}")
