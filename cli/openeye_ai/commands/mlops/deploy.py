"""Deployment commands — registry, promotion, A/B testing, shadow, export."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console

deploy_app = typer.Typer()


# ── Upload + Register ─────────────────────────────────────────────────


@deploy_app.command("upload")
def mlops_upload(
    file: Path = typer.Argument(help="Path to model file (ONNX, TorchScript, SafeTensors, PyTorch)"),
    name: str | None = typer.Option(None, "--name", "-n", help="Human-readable model name (default: filename stem)"),
    key: str | None = typer.Option(None, "--key", "-k", help="Registry key / slug (default: filename stem, lowered)"),
    format: str | None = typer.Option(None, "--format", "-f", help="Model format: onnx, torchscript, safetensors, pytorch (auto-detected if omitted)"),
    task: str = typer.Option("detection", "--task", "-t", help="Model task"),
    author: str = typer.Option("", "--author", help="Author name"),
    description: str = typer.Option("", "--description", "-d", help="Model description"),
    adapter: str = typer.Option("onnx_generic", "--adapter", help="Adapter key"),
) -> None:
    """Upload a custom-trained model and register it in the enterprise registry."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    # Auto-infer name/key from filename
    stem = file.stem.replace("_", "-").replace(" ", "-")
    resolved_name = name or stem
    resolved_key = key or stem.lower()

    # Auto-detect format from extension
    if format:
        try:
            fmt = ModelFormat(format)
        except ValueError:
            rprint(f"[red]Invalid format '{format}'. Use: onnx, torchscript, safetensors, pytorch[/red]")
            raise typer.Exit(code=1)
    else:
        ext_map = {
            ".onnx": ModelFormat.ONNX,
            ".pt": ModelFormat.PYTORCH,
            ".pth": ModelFormat.PYTORCH,
            ".safetensors": ModelFormat.SAFETENSORS,
            ".engine": ModelFormat.TENSORRT,
            ".trt": ModelFormat.TENSORRT,
            ".mlmodel": ModelFormat.COREML,
        }
        fmt = ext_map.get(file.suffix.lower())
        if fmt is None:
            rprint(f"[red]Cannot auto-detect format from '{file.suffix}'. Use --format.[/red]")
            raise typer.Exit(code=1)

    try:
        req = ModelUploadRequest(
            name=resolved_name, key=resolved_key, format=fmt, task=task,
            description=description, author=author,
            file_path=str(file), adapter=adapter,
        )
        version = upload_and_register(req)
        rprint(f"[green]Registered '{resolved_name}' as '{resolved_key}' v{version.version}[/green]")
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
    """List all versions of a model with their stage (dev/staging/prod)."""
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
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Version to promote"),
    from_stage: str = typer.Option(..., "--from", help="Current stage: dev, staging"),
    to_stage: str = typer.Option(..., "--to", help="Target stage: staging, production"),
    requester: str = typer.Option("cli-user", "--requester", help="Requester name"),
    reason: str = typer.Option("", "--reason", help="Reason for promotion"),
) -> None:
    """Promote a model version to a new stage (dev -> staging -> production)."""
    from openeye_ai.mlops.lifecycle import request_promotion
    from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

    try:
        target = ModelStage(to_stage)
    except ValueError:
        rprint(f"[red]Invalid target stage '{to_stage}'. Use: staging, production, archived[/red]")
        raise typer.Exit(code=1)

    try:
        req = PromotionRequest(
            model_key=model, version=version,
            target_stage=target, requester=requester, reason=reason,
        )
        record = request_promotion(req)
        rprint(f"[green]Promotion {record.from_stage.value} -> {record.to_stage.value}: {record.status.value}[/green]")
        if record.approver:
            rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("approve-promotion")
def mlops_approve_promotion(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Approver name"),
) -> None:
    """Approve a pending model promotion (gated workflow)."""
    from openeye_ai.mlops.lifecycle import approve_promotion

    try:
        record = approve_promotion(model, version, approver)
        rprint(f"[green]Promotion approved:[/green] {record.from_stage.value} -> {record.to_stage.value}")
        rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("reject-promotion")
def mlops_reject_promotion(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Reviewer name"),
    reason: str = typer.Option("", "--reason", "-r", help="Rejection reason"),
) -> None:
    """Reject a pending model promotion."""
    from openeye_ai.mlops.lifecycle import reject_promotion

    try:
        record = reject_promotion(model, version, approver, reason)
        rprint(f"[yellow]Promotion rejected:[/yellow] {record.from_stage.value} -> {record.to_stage.value}")
        if record.reason:
            rprint(f"  Reason: {record.reason}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── A/B Test ──────────────────────────────────────────────────────────


@deploy_app.command("create-ab-test")
def mlops_create_ab_test(
    champion: str = typer.Option(..., "--champion", help="Champion (control) model version, e.g. yolov8-v2"),
    challenger: str = typer.Option(..., "--challenger", help="Challenger model version, e.g. yolov8-v3"),
    traffic: str = typer.Option("50/50", "--traffic", help="Traffic split champion/challenger, e.g. 80/20"),
    name: str = typer.Option("", "--name", help="Test name"),
    model: str | None = typer.Option(None, "--model", "-m", help="Model key (auto-detected from champion)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Create an A/B test between two model versions."""
    from openeye_ai.mlops.ab_testing import create_ab_test
    from openeye_ai.mlops.schemas import ABTestConfig

    # Parse traffic split, e.g. "80/20"
    try:
        parts = traffic.split("/")
        champion_pct = int(parts[0])
        challenger_pct = int(parts[1])
        split = challenger_pct / (champion_pct + challenger_pct)
    except (ValueError, IndexError, ZeroDivisionError):
        rprint(f"[red]Invalid traffic split '{traffic}'. Use format like 80/20.[/red]")
        raise typer.Exit(code=1)

    # Auto-detect model key from champion string (e.g. "yolov8-v2" -> "yolov8")
    model_key = model or (champion.rsplit("-v", 1)[0] if "-v" in champion else champion)

    config = ABTestConfig(
        name=name or f"{model_key} A/B: {champion} vs {challenger}",
        model_key=model_key,
        version_a=champion,
        version_b=challenger,
        traffic_split=split,
        max_samples=max_samples,
    )
    test = create_ab_test(config)
    rprint(f"[green]A/B test created: {test.id}[/green]")
    rprint(f"  Champion: {champion} ({champion_pct}%) vs Challenger: {challenger} ({challenger_pct}%)")


@deploy_app.command("ab-tests")
def mlops_ab_tests(model_key: str | None = typer.Argument(None, help="Filter by model key")) -> None:
    """Show running A/B tests and their metrics."""
    from openeye_ai.mlops.ab_testing import list_ab_tests

    tests = list_ab_tests(model_key)
    if not tests:
        rprint("[dim]No A/B tests found.[/dim]")
        return

    table = Table(title="A/B Tests")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("Champion")
    table.add_column("Challenger")
    table.add_column("Status", style="magenta")
    table.add_column("Champ Acc", justify="right")
    table.add_column("Chall Acc", justify="right")
    table.add_column("Champ Lat", justify="right")
    table.add_column("Chall Lat", justify="right")
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


@deploy_app.command("complete-ab-test")
def mlops_complete_ab_test(
    test_id: str = typer.Argument(help="A/B test ID to complete"),
) -> None:
    """Complete an A/B test and graduate the winner."""
    from openeye_ai.mlops.ab_testing import complete_ab_test

    try:
        test = complete_ab_test(test_id)
        rprint(f"[green]A/B test completed: {test.id}[/green]")
        rprint(f"  Champion: {test.config.version_a} | Challenger: {test.config.version_b}")
        if test.winner:
            rprint(f"  [bold green]Winner: {test.winner}[/bold green]")
        else:
            rprint("  [yellow]No clear winner.[/yellow]")
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── Shadow Mode ───────────────────────────────────────────────────────


@deploy_app.command("shadow-mode")
def mlops_shadow_mode(
    champion: str = typer.Option(..., "--champion", help="Production (champion) version"),
    challenger: str = typer.Option(..., "--challenger", help="Shadow (challenger) version"),
    model: str | None = typer.Option(None, "--model", "-m", help="Model key (auto-detected from champion)"),
    sample_rate: float = typer.Option(1.0, "--sample-rate", help="Fraction of traffic to shadow (0-1)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Test a new model in shadow mode without affecting production."""
    from openeye_ai.mlops.shadow_mode import create_shadow_deployment
    from openeye_ai.mlops.schemas import ShadowDeploymentConfig

    # Auto-detect model key
    model_key = model or (champion.rsplit("-v", 1)[0] if "-v" in champion else champion)

    config = ShadowDeploymentConfig(
        name=f"shadow-{model_key}-{challenger}",
        model_key=model_key,
        production_version=champion,
        shadow_version=challenger,
        sample_rate=sample_rate,
        max_samples=max_samples,
    )
    dep = create_shadow_deployment(config)
    rprint(f"[green]Shadow deployment created: {dep.id}[/green]")
    rprint(f"  Champion: {champion} | Challenger: {challenger} (shadow) | Rate: {sample_rate:.0%}")


@deploy_app.command("shadow-status")
def mlops_shadow_status(model_key: str | None = typer.Argument(None, help="Filter by model")) -> None:
    """Show shadow deployment status and comparison metrics."""
    from openeye_ai.mlops.shadow_mode import list_shadow_deployments

    deps = list_shadow_deployments(model_key)
    if not deps:
        rprint("[dim]No shadow deployments found.[/dim]")
        return

    table = Table(title="Shadow Deployments")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("Champion")
    table.add_column("Challenger")
    table.add_column("Status", style="magenta")
    table.add_column("Samples", justify="right")
    table.add_column("Agreement", justify="right")
    table.add_column("Champ Lat", justify="right")
    table.add_column("Chall Lat", justify="right")

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
    format: str = typer.Option(..., "--format", "-f", help="Export format: onnx, tensorrt, coreml"),
    version: str = typer.Option("latest", "--version", "-v", help="Model version (default: latest)"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Output path"),
    quantize: bool = typer.Option(False, "--quantize", help="Apply INT8 quantization"),
) -> None:
    """Export a model to ONNX, TensorRT, or CoreML format for deployment."""
    from openeye_ai.mlops.export import export_model
    from openeye_ai.mlops.model_registry import get_registered_model
    from openeye_ai.mlops.schemas import ExportFormat, ExportRequest

    try:
        fmt = ExportFormat(format)
    except ValueError:
        rprint(f"[red]Invalid format '{format}'. Use: onnx, tensorrt, coreml[/red]")
        raise typer.Exit(code=1)

    # Resolve "latest" version
    resolved_version = version
    if version == "latest":
        try:
            entry = get_registered_model(model_key)
            if entry.latest_version:
                resolved_version = entry.latest_version.version
            else:
                rprint(f"[red]No versions found for '{model_key}'.[/red]")
                raise typer.Exit(code=1)
        except KeyError as e:
            rprint(f"[red]{e}[/red]")
            raise typer.Exit(code=1)

    request = ExportRequest(
        model_key=model_key,
        model_version=resolved_version,
        target_format=fmt,
        output_path=str(output) if output else None,
        quantize=quantize,
    )

    try:
        with console.status(f"Exporting {model_key} v{resolved_version} to {format}..."):
            result = export_model(request)
        rprint(f"[green]Exported to: {result.output_path}[/green]")
        rprint(f"  Size: {result.output_size_mb:.1f} MB | Duration: {result.export_duration_seconds:.1f}s")
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@deploy_app.command("exports")
def mlops_exports(
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
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
