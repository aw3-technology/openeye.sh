"""Inference commands — run, bench, serve, watch."""

from __future__ import annotations

import collections
import signal
import sys
import time
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error, err_console, warmup_adapter
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
)


# ── run ───────────────────────────────────────────────────────────────


def run(
    model: str = typer.Argument(help="Model name (e.g. yolov8)"),
    image: Optional[Path] = typer.Argument(None, help="Path to image file (use '-' or omit for stdin pipe)"),
    prompt: Optional[str] = typer.Option(None, "--prompt", "-p", help="Text prompt (for grounding-dino)"),
    pretty: bool = typer.Option(False, "--pretty", help="Pretty-print JSON output"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Write JSON output to file"),
    visualize: bool = typer.Option(False, "--visualize", help="Save annotated image with bounding boxes"),
    backend: Optional[str] = typer.Option(None, "--backend", "-b", help="Backend: onnx, tensorrt"),
    variant: Optional[str] = typer.Option(None, "--variant", help="Use a specific model variant"),
) -> None:
    """Run inference on an image and output unified JSON."""
    import json

    from PIL import Image, UnidentifiedImageError

    from openeye_ai.schema import ImageInfo, PredictionResult

    effective_variant = variant
    if backend and not effective_variant:
        effective_variant = backend

    try:
        if effective_variant:
            info = get_variant_info(model, effective_variant)
        else:
            info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if effective_variant:
        model_dir = MODELS_DIR / model / f".variant-{effective_variant}"
        if not is_variant_downloaded(model, effective_variant):
            rprint(f"[yellow]Variant '{effective_variant}' not downloaded. Run: openeye pull {model} --variant {effective_variant}[/yellow]")
            raise typer.Exit(code=1)
    else:
        model_dir = MODELS_DIR / model
        if not is_downloaded(model):
            rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
            raise typer.Exit(code=1)

    # Resolve image source
    piped_data = None
    if image is not None and str(image) == "-":
        image = None

    if image is None:
        if sys.stdin.isatty():
            rprint("[red]No image provided. Pass a file path or pipe JSON from a previous run.[/red]")
            raise typer.Exit(code=1)
        raw = sys.stdin.read()
        try:
            piped_data = json.loads(raw)
            image = Path(piped_data["image"]["source"])
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            rprint(f"[red]Invalid piped JSON (expected {{\"image\": {{\"source\": \"...\"}}}}):[/red] {e}")
            raise typer.Exit(code=1)

    if not image.exists():
        rprint(f"[red]Image not found: {image}[/red]")
        raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model, variant=effective_variant)
    except ImportError as e:
        dependency_error(model, e)

    try:
        with err_console.status(f"Loading {info['name']}..."):
            adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load model: {e}[/red]")
        raise typer.Exit(code=1)

    try:
        img = Image.open(image).convert("RGB")
    except (UnidentifiedImageError, Exception) as e:
        rprint(f"[red]Cannot open image: {e}[/red]")
        raise typer.Exit(code=1)
    w, h = img.size

    try:
        with err_console.status("Running inference..."):
            if prompt and hasattr(adapter, "predict_with_prompt"):
                result_data = adapter.predict_with_prompt(img, prompt)
            else:
                result_data = adapter.predict(img)
    except Exception as e:
        rprint(f"[red]Inference failed: {e}[/red]")
        raise typer.Exit(code=1)

    result = PredictionResult(
        model=model,
        task=info["task"],
        image=ImageInfo(width=w, height=h, source=str(image)),
        **result_data,
    )

    json_output = result.model_dump_json(indent=2 if pretty else None)

    if output is not None:
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json_output)
        except OSError as e:
            rprint(f"[red]Failed to write output file: {e}[/red]", file=sys.stderr)
            raise typer.Exit(code=1)
        rprint(f"[green]Results written to {output}[/green]", file=sys.stderr)

    if visualize:
        from openeye_ai.utils.visualize import draw_boxes, save_depth_map

        try:
            if result.depth_map:
                depth_path = image.with_name(f"{image.stem}_depth.png")
                save_depth_map(result.depth_map, depth_path)
                rprint(f"[green]Depth map saved to {depth_path}[/green]", file=sys.stderr)
            elif result.objects:
                annotated = draw_boxes(img, [o.model_dump() for o in result.objects])
                annotated_path = image.with_name(f"{image.stem}_annotated.png")
                annotated.save(annotated_path)
                rprint(f"[green]Annotated image saved to {annotated_path}[/green]", file=sys.stderr)
            else:
                rprint("[yellow]No objects or depth map to visualize.[/yellow]", file=sys.stderr)
        except OSError as e:
            rprint(f"[red]Failed to save visualization: {e}[/red]", file=sys.stderr)

    print(json_output)


# ── bench ─────────────────────────────────────────────────────────────


def bench(
    model: str = typer.Argument(help="Model name to benchmark"),
    variant: Optional[str] = typer.Option(None, "--variant", help="Variant to benchmark"),
    warmup: int = typer.Option(3, "--warmup", help="Number of warmup runs"),
    runs: int = typer.Option(10, "--runs", help="Number of timed runs"),
    width: int = typer.Option(640, "--width", help="Test image width"),
    height: int = typer.Option(480, "--height", help="Test image height"),
) -> None:
    """Benchmark a model's inference speed."""
    if warmup < 0 or runs < 1 or width < 1 or height < 1:
        rprint("[red]Invalid benchmark parameters: warmup >= 0, runs/width/height >= 1[/red]")
        raise typer.Exit(code=1)

    from openeye_ai.utils.benchmark import run_benchmark

    try:
        if variant:
            info = get_variant_info(model, variant)
        else:
            info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if variant:
        model_dir = MODELS_DIR / model / f".variant-{variant}"
        if not is_variant_downloaded(model, variant):
            rprint(f"[yellow]Variant '{variant}' not downloaded. Run: openeye pull {model} --variant {variant}[/yellow]")
            raise typer.Exit(code=1)
    else:
        model_dir = MODELS_DIR / model
        if not is_downloaded(model):
            rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
            raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model, variant=variant)
    except ImportError as e:
        dependency_error(model, e)

    rprint(f"[bold]Loading {info['name']}...[/bold]")
    try:
        adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load model: {e}[/red]")
        raise typer.Exit(code=1)

    rprint(f"[bold]Benchmarking {info['name']} ({warmup} warmup, {runs} runs, {width}x{height})...[/bold]")
    try:
        result = run_benchmark(
            adapter,
            model_name=model,
            variant=variant,
            warmup=warmup,
            runs=runs,
            width=width,
            height=height,
        )
    except Exception as e:
        rprint(f"[red]Benchmark failed: {e}[/red]")
        raise typer.Exit(code=1)

    table = Table(title=f"Benchmark: {info['name']}")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right", style="bold")
    table.add_row("Mean", f"{result.mean_ms:.2f} ms")
    table.add_row("Median", f"{result.median_ms:.2f} ms")
    table.add_row("P95", f"{result.p95_ms:.2f} ms")
    table.add_row("FPS", f"{result.fps:.1f}")
    table.add_row("Runs", str(result.runs))
    table.add_row("Image Size", f"{width}x{height}")
    if variant:
        table.add_row("Variant", variant)
    console.print(table)


# ── serve ─────────────────────────────────────────────────────────────


def serve(
    model: str = typer.Argument(help="Model name to serve"),
    host: str = typer.Option("0.0.0.0", "--host", help="Bind host"),
    port: int = typer.Option(8000, "--port", help="Bind port"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up model, show live status bar"),
    vlm_model: Optional[str] = typer.Option(None, "--vlm-model", help="VLM model ID for perception (e.g. qwen/qwen3.5-9b, openrouter/healer-alpha)"),
    cortex_llm: Optional[str] = typer.Option(None, "--cortex-llm", help="Cortex LLM model ID for reasoning (e.g. z-ai/glm-5-turbo, openrouter/hunter-alpha)"),
) -> None:
    """Start a FastAPI server with REST API, WebSocket, and browser dashboard."""
    if port < 1 or port > 65535:
        rprint(f"[red]Invalid port {port}. Must be between 1 and 65535.[/red]")
        raise typer.Exit(code=1)

    import threading

    import uvicorn

    from rich.live import Live
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai.server.app import create_app

    try:
        info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    model_dir = MODELS_DIR / model

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
        raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model)
    except ImportError as e:
        dependency_error(model, e)

    with console.status(f"[bold]Loading {info['name']}...[/bold]"):
        try:
            adapter.load(model_dir)
        except ImportError as e:
            dependency_error(model, e)
        except Exception as e:
            rprint(f"[red]Failed to load model: {e}[/red]")
            raise typer.Exit(code=1)

    if demo:
        try:
            with console.status("[bold]Warming up model (demo mode)...[/bold]"):
                warmup_adapter(adapter, model)
        except Exception as e:
            rprint(f"[yellow]Warm-up failed ({e}), continuing anyway...[/yellow]")

    fastapi_app = create_app(
        adapter=adapter,
        model_name=model,
        model_info=info,
        vlm_model=vlm_model,
        cortex_llm=cortex_llm,
    )

    banner = (
        f"[bold green]* {info['name']}[/bold green] ready on "
        f"[bold]http://{host}:{port}[/bold]\n"
        f"  [dim]Dashboard[/dim]  -> http://localhost:{port}/\n"
        f"  [dim]API[/dim]       -> http://localhost:{port}/predict\n"
        f"  [dim]WebSocket[/dim] -> ws://localhost:{port}/ws\n"
        f"  [dim]Metrics[/dim]   -> http://localhost:{port}/metrics"
    )
    if demo:
        banner += "\n  [bold yellow]Demo mode[/bold yellow] -- model is warm, zero cold-start"
    console.print(Panel(banner, title="[bold]OpenEye Server[/bold]", border_style="green"))

    if not demo:
        # Standard mode: run uvicorn directly
        uvicorn.run(fastapi_app, host=host, port=port, log_level="info")
    else:
        # Demo mode: run uvicorn in a background thread and show a persistent
        # Rich status bar with uptime, total requests, and active connections.
        from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, REQUEST_COUNT

        server_start = time.monotonic()
        server_config = uvicorn.Config(
            fastapi_app, host=host, port=port, log_level="info",
        )
        server = uvicorn.Server(server_config)

        server_thread = threading.Thread(target=server.run, daemon=True)
        server_thread.start()

        def _format_uptime(seconds: float) -> str:
            h, rem = divmod(int(seconds), 3600)
            m, s = divmod(rem, 60)
            if h > 0:
                return f"{h}h {m:02d}m {s:02d}s"
            return f"{m}m {s:02d}s"

        def _get_total_requests() -> int:
            total = 0.0
            try:
                for sample in REQUEST_COUNT.collect()[0].samples:
                    total += sample.value
            except Exception:
                pass
            return int(total)

        def _get_active_connections() -> int:
            try:
                return int(ACTIVE_CONNECTIONS._value.get())
            except Exception:
                return 0

        try:
            with Live(console=console, refresh_per_second=2) as live:
                while server_thread.is_alive():
                    elapsed = time.monotonic() - server_start
                    total_reqs = _get_total_requests()
                    active_conns = _get_active_connections()

                    conn_style = "bold green" if active_conns > 0 else "dim"

                    status_bar = Text.assemble(
                        ("  Uptime ", "dim"),
                        (_format_uptime(elapsed), "bold cyan"),
                        ("  |  Requests ", "dim"),
                        (f"{total_reqs:,}", "bold"),
                        ("  |  Connections ", "dim"),
                        (f"{active_conns}", conn_style),
                        ("  |  Model ", "dim"),
                        (model, "bold cyan"),
                        ("  |  ", "dim"),
                        ("LIVE", "bold green"),
                    )

                    live.update(
                        Panel(
                            status_bar,
                            title="[bold]OpenEye Server Status[/bold]",
                            border_style="green",
                        )
                    )
                    time.sleep(0.5)
        except KeyboardInterrupt:
            console.print("\n[dim]Shutting down server...[/dim]")
            server.should_exit = True
            server_thread.join(timeout=5)


# ── watch ─────────────────────────────────────────────────────────────


def watch(
    models: str = typer.Option("yolov8", "--models", "-m", help="Comma-separated model names"),
    camera: int = typer.Option(0, "--camera", "-c", help="Camera index"),
    video: Optional[str] = typer.Option(None, "--video", "-v", help="Video file path (fallback if camera fails)"),
    safety: bool = typer.Option(False, "--safety", "-s", help="Enable Safety Guardian overlay"),
    danger_m: float = typer.Option(0.5, "--danger-m", help="Danger zone threshold in metres (requires --safety)"),
    caution_m: float = typer.Option(1.5, "--caution-m", help="Caution zone threshold in metres (requires --safety)"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up models for zero cold-start"),
) -> None:
    """Live camera feed with real-time detections displayed in terminal."""
    if camera < 0:
        rprint(f"[red]Invalid camera index {camera}. Must be >= 0.[/red]")
        raise typer.Exit(code=1)
    if safety and danger_m >= caution_m:
        rprint(f"[red]danger-m ({danger_m}) must be less than caution-m ({caution_m}).[/red]")
        raise typer.Exit(code=1)

    from rich.columns import Columns
    from rich.console import Group
    from rich.live import Live
    from rich.markup import escape as rich_escape
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai.utils.camera import Camera, VideoPlayer

    model_list = [m.strip() for m in models.split(",")]

    adapters = {}
    for m in model_list:
        try:
            info = get_model_info(m)
        except KeyError as e:
            rprint(f"[red]{e}[/red]")
            raise typer.Exit(code=1)
        model_dir = MODELS_DIR / m
        if not is_downloaded(m):
            rprint(f"[yellow]Model '{m}' not downloaded. Run: openeye pull {m}[/yellow]")
            raise typer.Exit(code=1)
        try:
            adapter = get_adapter(m)
        except ImportError as e:
            dependency_error(m, e)
        try:
            with console.status(f"[bold]Loading {info['name']}...[/bold]"):
                adapter.load(model_dir)
                adapters[m] = adapter
        except ImportError as e:
            dependency_error(m, e)
        except Exception as e:
            rprint(f"[red]Failed to load '{m}': {e}[/red]")
            raise typer.Exit(code=1)

    if demo:
        for m, adapter in adapters.items():
            try:
                with console.status(f"[bold]Warming up {m} (demo mode)...[/bold]"):
                    warmup_adapter(adapter, m)
            except Exception as e:
                rprint(f"[yellow]Warm-up failed for {m} ({e}), continuing anyway...[/yellow]")

    # Set up Safety Guardian if --safety flag is active
    guardian = None
    _BBox2D = None
    _DetectedObject3D = None
    _Position3D = None
    if safety:
        try:
            _repo_root = Path(__file__).resolve().parent
            for _ in range(6):
                if (_repo_root / "backend" / "src" / "perception").is_dir():
                    break
                _repo_root = _repo_root.parent
            else:
                rprint("[red]Cannot find backend/src/perception -- run from the repo root[/red]")
                raise typer.Exit(code=1)
            sys.path.insert(0, str(_repo_root / "backend" / "src"))
            from perception.safety import SafetyGuardian
            from perception.models import BBox2D, DetectedObject3D, Position3D
            _BBox2D = BBox2D
            _DetectedObject3D = DetectedObject3D
            _Position3D = Position3D
            guardian = SafetyGuardian(danger_m=danger_m, caution_m=caution_m)
            rprint(f"[green]Safety Guardian enabled:[/green] danger < {danger_m}m, caution < {caution_m}m")
        except Exception as e:
            rprint(f"[yellow]Failed to load Safety Guardian: {e}[/yellow]")
            rprint("[yellow]Continuing without safety overlay.[/yellow]")

    # Handle SIGTERM for graceful shutdown (e.g. systemd stop)
    _sigterm_received = False

    def _sigterm_handler(signum, frame):
        nonlocal _sigterm_received
        _sigterm_received = True
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    # Set up camera with video fallback
    source_label = f"camera {camera}"
    cam = None

    if video:
        # Video explicitly provided -- use it directly
        try:
            cam = VideoPlayer(video)
            source_label = f"video: {Path(video).name}"
            rprint(f"[green]Using video source:[/green] {video}")
        except (FileNotFoundError, RuntimeError) as e:
            rprint(f"[yellow]Cannot open video file ({e}), trying camera...[/yellow]")

    if cam is None:
        try:
            cam = Camera(camera)
        except ImportError:
            rprint(
                "[red]Missing opencv-python.[/red]\n"
                "Install with: [bold]pip install openeye-ai\\[camera][/bold]"
            )
            if not video:
                raise typer.Exit(code=1)
        except RuntimeError as e:
            rprint(f"[yellow]Camera failed: {e}[/yellow]")
            if video:
                # Try video as fallback
                try:
                    cam = VideoPlayer(video)
                    source_label = f"video: {Path(video).name}"
                    rprint(f"[green]Falling back to video:[/green] {video}")
                except (FileNotFoundError, RuntimeError) as ve:
                    rprint(f"[red]Cannot open video file: {ve}[/red]")
                    raise typer.Exit(code=1)
            else:
                rprint("[yellow]Tip: Use --video <path> to use a pre-recorded video file.[/yellow]")
                raise typer.Exit(code=1)

    if cam is None:
        rprint("[red]No input source available.[/red]")
        raise typer.Exit(code=1)

    model_label = ", ".join(model_list)
    header = (
        f"[bold green]* LIVE[/bold green]  "
        f"Models: [bold cyan]{model_label}[/bold cyan]  "
        f"Source: [dim]{source_label}[/dim]  "
        f"Press [bold]Ctrl+C[/bold] to stop"
    )
    if safety:
        header += "  [bold red]Safety[/bold red]"
    if demo:
        header += "  [bold yellow]Demo[/bold yellow]"

    frame_times: collections.deque[float] = collections.deque(maxlen=60)
    dropped = 0
    frame_count = 0

    try:
        console.print(Panel(header, border_style="green"))
        with Live(console=console, refresh_per_second=12) as live:
            while True:
                loop_start = time.perf_counter()

                frame = cam.read_pil()
                if frame is None:
                    dropped += 1
                    if dropped > 30:
                        rprint("[red]Input source stopped responding. Exiting.[/red]")
                        break
                    time.sleep(0.1)
                    continue
                dropped = 0
                frame_count += 1

                all_rows: list[tuple[str, str, str, str, str]] = []
                all_objects: list[dict] = []
                total_inference_ms = 0.0
                for m, adapter in adapters.items():
                    result = adapter.predict(frame)
                    inf_ms = result.get("inference_ms", 0.0)
                    total_inference_ms += inf_ms
                    for obj in result.get("objects", []):
                        all_objects.append(obj)
                        conf = obj["confidence"]
                        if conf >= 0.7:
                            conf_str = f"[bold green]{conf:.1%}[/bold green]"
                        elif conf >= 0.4:
                            conf_str = f"[yellow]{conf:.1%}[/yellow]"
                        else:
                            conf_str = f"[red]{conf:.1%}[/red]"
                        all_rows.append((
                            m,
                            rich_escape(obj["label"]),
                            conf_str,
                            f"({obj['bbox']['x']:.2f}, {obj['bbox']['y']:.2f})",
                            f"{inf_ms:.1f}",
                        ))

                now = time.perf_counter()
                frame_times.append(now)
                if len(frame_times) >= 2:
                    elapsed = frame_times[-1] - frame_times[0]
                    fps = (len(frame_times) - 1) / elapsed if elapsed > 0 else 0.0
                else:
                    fps = 0.0

                if total_inference_ms < 50:
                    lat_color = "bold green"
                elif total_inference_ms < 100:
                    lat_color = "bold yellow"
                else:
                    lat_color = "bold red"

                stats = Text.assemble(
                    ("  FPS ", "dim"),
                    (f"{fps:.1f}", "bold cyan"),
                    ("  |  Latency ", "dim"),
                    (f"{total_inference_ms:.1f} ms", lat_color),
                    ("  |  Objects ", "dim"),
                    (f"{len(all_rows)}", "bold"),
                    ("  |  Frames ", "dim"),
                    (f"{frame_count}", "dim"),
                )

                table = Table(
                    show_header=True,
                    header_style="bold",
                    border_style="bright_black",
                    title_style="bold",
                    pad_edge=True,
                    expand=True,
                )
                table.add_column("Model", style="cyan", ratio=2)
                table.add_column("Detection", style="bold white", ratio=3)
                table.add_column("Conf", justify="right", ratio=1)
                table.add_column("Position", style="dim", ratio=2)
                table.add_column("ms", justify="right", style="dim", ratio=1)

                for row in all_rows:
                    table.add_row(*row)

                if not all_rows:
                    table.add_row("--", "[dim]No detections[/dim]", "", "", "")

                layout = Columns(
                    [Panel(table, title="[bold]Detections[/bold]", border_style="blue")],
                    expand=True,
                )

                # Build display parts
                display_parts: list = [stats, layout]

                # Safety Guardian overlay
                if guardian is not None and _DetectedObject3D is not None:
                    human_labels = {"person", "human", "man", "woman", "child", "pedestrian"}
                    objects_3d = []
                    for i, obj in enumerate(all_objects):
                        bbox = obj.get("bbox", {})
                        bbox_h = bbox.get("h", 0.1)
                        estimated_depth = max(0.3, 1.8 / max(bbox_h, 0.01))
                        objects_3d.append(_DetectedObject3D(
                            track_id=f"obj_{i}",
                            label=obj.get("label", "unknown"),
                            confidence=obj.get("confidence", 0.0),
                            bbox=_BBox2D(
                                x1=bbox.get("x", 0),
                                y1=bbox.get("y", 0),
                                x2=bbox.get("x", 0) + bbox.get("w", 0),
                                y2=bbox.get("y", 0) + bbox.get("h", 0),
                            ),
                            position_3d=_Position3D(
                                x=(bbox.get("x", 0.5) + bbox.get("w", 0) / 2 - 0.5) * estimated_depth,
                                y=0.0,
                                z=estimated_depth,
                            ),
                        ))

                    alerts, zones = guardian.evaluate(objects_3d)
                    n_humans = sum(1 for o in objects_3d if o.label.lower() in human_labels)

                    safety_table = Table(
                        show_header=True,
                        header_style="bold",
                        border_style="bright_black",
                        expand=True,
                    )
                    safety_table.add_column("Zone", justify="center", width=10)
                    safety_table.add_column("Track", style="cyan")
                    safety_table.add_column("Distance", justify="right")
                    safety_table.add_column("Alert", style="bold")

                    if zones:
                        for z in zones:
                            zone_val = z.zone.value
                            if zone_val == "danger":
                                zone_str = "[bold white on red] DANGER [/bold white on red]"
                            elif zone_val == "caution":
                                zone_str = "[bold black on yellow] CAUTION [/bold black on yellow]"
                            else:
                                zone_str = "[bold white on green]  SAFE  [/bold white on green]"
                            safety_table.add_row(
                                zone_str,
                                z.human_track_id,
                                f"{z.distance_m:.2f}m",
                                f"{z.bearing_deg:.0f} deg",
                            )
                    else:
                        safety_table.add_row(
                            "[bold white on green]  SAFE  [/bold white on green]",
                            "[dim]--[/dim]",
                            "[dim]--[/dim]",
                            f"[dim]{n_humans} humans tracked[/dim]",
                        )

                    alert_text = Text()
                    if alerts:
                        for a in alerts:
                            style = "bold red" if a.halt_recommended else "yellow"
                            alert_text.append(f"  {a.message}\n", style=style)
                    else:
                        alert_text.append("  Workspace clear", style="dim green")

                    safety_panel = Panel(
                        Group(safety_table, alert_text),
                        title="[bold]Safety Guardian[/bold]",
                        border_style="red" if alerts else "green",
                    )
                    display_parts.append(safety_panel)

                display = Group(*display_parts)
                live.update(
                    Panel(
                        display,
                        title="[bold]OpenEye Watch[/bold]",
                        subtitle=f"[dim]{model_label} | {source_label}[/dim]",
                        border_style="green",
                    )
                )

                elapsed_loop = time.perf_counter() - loop_start
                sleep_time = max(0, 0.05 - elapsed_loop)
                if sleep_time > 0:
                    time.sleep(sleep_time)

    except KeyboardInterrupt:
        pass
    finally:
        cam.release()
        console.print(
            Panel(
                f"[dim]Session ended. {frame_count} frames processed.[/dim]",
                border_style="dim",
            )
        )
