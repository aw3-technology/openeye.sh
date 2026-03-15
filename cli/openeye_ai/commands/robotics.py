"""CLI commands for the robotics SDK: serve, test, bench."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

robotics_app = typer.Typer(
    help="Robotics SDK — serve, test, and benchmark the vision pipeline for robots.",
)

@robotics_app.command()
def serve(
    model: str = typer.Option("yolov8", "--model", "-m", help="Model name"),
    variant: str | None = typer.Option(None, "--variant", help="Model variant"),
    host: str = typer.Option("0.0.0.0", "--host", help="Bind address"),
    port: int = typer.Option(8000, "--port", "-p", help="REST port"),
    grpc: bool = typer.Option(False, "--grpc", help="Enable gRPC server"),
    grpc_port: int = typer.Option(50051, "--grpc-port", help="gRPC port"),
    mqtt: bool = typer.Option(False, "--mqtt", help="Enable MQTT publisher"),
    mqtt_broker: str = typer.Option(
        "mqtt://localhost:1883", "--mqtt-broker", help="MQTT broker URL"
    ),
    robot_id: str = typer.Option("robot-01", "--robot-id", help="Robot ID for MQTT topics"),
) -> None:
    """Start the robotics vision server (REST + optional gRPC/MQTT)."""
    rprint(f"[bold green]Starting robotics vision server[/bold green]")
    rprint(f"  Model: {model}" + (f" ({variant})" if variant else ""))
    rprint(f"  REST:  {host}:{port}")

    from openeye_ai.robotics import RobotVision, RobotVisionConfig

    config = RobotVisionConfig(mode="server", model=model, variant=variant)
    vision = RobotVision(config)
    vision.start()

    if grpc:
        rprint(f"  gRPC:  {host}:{grpc_port}")
        try:
            from openeye_ai.robotics._pipeline_bridge import ensure_backend_path

            ensure_backend_path()
            from perception_grpc.server import PerceptionGRPCServer

            grpc_server = PerceptionGRPCServer(
                pipeline=vision._pipeline,
                port=grpc_port,
            )
            grpc_server.start()
            rprint("[green]gRPC server started[/green]")
        except ImportError:
            rprint("[yellow]gRPC dependencies not available. Install with: pip install openeye-ai[robotics][/yellow]")

    if mqtt:
        rprint(f"  MQTT:  {mqtt_broker} (robot_id={robot_id})")
        try:
            from openeye_ai.robotics.mqtt.publisher import MQTTPerceptionPublisher
            from openeye_ai.robotics.mqtt.config import MQTTConfig

            mqtt_config = MQTTConfig(broker_url=mqtt_broker, robot_id=robot_id)
            mqtt_pub = MQTTPerceptionPublisher(mqtt_config)
            mqtt_pub.connect()
            rprint("[green]MQTT publisher connected[/green]")
        except ImportError:
            rprint("[yellow]MQTT dependencies not available. Install with: pip install openeye-ai[robotics][/yellow]")

    # Start FastAPI server
    rprint(f"\n[bold]Listening on http://{host}:{port}[/bold]")
    import uvicorn

    from openeye_ai.server.app import create_app

    app = create_app(model_name=model)
    uvicorn.run(app, host=host, port=port)

@robotics_app.command()
def test(
    model: str = typer.Option("yolov8", "--model", "-m", help="Model to test"),
    image: str | None = typer.Option(None, "--image", "-i", help="Path to test image"),
) -> None:
    """Quick smoke test of the robotics SDK."""
    import numpy as np

    from openeye_ai.robotics import RobotVision, RobotVisionConfig

    config = RobotVisionConfig(mode="server", model=model)
    rprint(f"[bold]Testing RobotVision[/bold] (model={model})")

    vision = RobotVision(config)
    vision.start()

    if image:
        from PIL import Image

        img = Image.open(image).convert("RGB")
        frame = np.array(img)
        rprint(f"  Image: {image} ({frame.shape[1]}x{frame.shape[0]})")
    else:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        rprint("  Using blank test frame (640x480)")

    result = vision.perceive(frame)

    table = Table(title="Perception Results")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="green")
    table.add_row("Frame ID", str(result.frame_id))
    table.add_row("Inference", f"{result.inference_ms:.1f} ms")
    table.add_row("Objects", str(len(result.objects)))
    table.add_row("Safety Alerts", str(len(result.safety_alerts)))
    table.add_row("Scene Graph Nodes", str(len(result.scene_graph.nodes)))
    table.add_row("Safe?", str(vision.is_safe()))
    table.add_row("Description", result.scene_description or "(empty)")
    rprint(table)

    if result.objects:
        obj_table = Table(title="Detected Objects")
        obj_table.add_column("ID")
        obj_table.add_column("Label")
        obj_table.add_column("Confidence")
        obj_table.add_column("Grasp Points")
        for obj in result.objects:
            obj_table.add_row(
                obj.track_id,
                obj.label,
                f"{obj.confidence:.2f}",
                str(len(obj.grasp_points)),
            )
        rprint(obj_table)

    vision.stop()
    rprint("[bold green]Test passed.[/bold green]")

@robotics_app.command()
def bench(
    model: str = typer.Option("yolov8", "--model", "-m", help="Model to benchmark"),
    frames: int = typer.Option(100, "--frames", "-n", help="Number of frames"),
    width: int = typer.Option(640, "--width", help="Frame width"),
    height: int = typer.Option(480, "--height", help="Frame height"),
) -> None:
    """Benchmark perception pipeline throughput."""
    import time

    import numpy as np
    from rich.progress import Progress

    from openeye_ai.robotics import RobotVision, RobotVisionConfig

    config = RobotVisionConfig(mode="server", model=model)
    vision = RobotVision(config)
    vision.start()

    rprint(f"[bold]Benchmarking[/bold] {frames} frames @ {width}x{height} (model={model})")

    latencies: list[float] = []
    with Progress() as progress:
        task = progress.add_task("Processing...", total=frames)
        for i in range(frames):
            frame = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
            t0 = time.perf_counter()
            vision.perceive(frame)
            latencies.append((time.perf_counter() - t0) * 1000)
            progress.update(task, advance=1)

    vision.stop()

    avg = sum(latencies) / len(latencies)
    p50 = sorted(latencies)[len(latencies) // 2]
    p99 = sorted(latencies)[int(len(latencies) * 0.99)]
    fps = 1000.0 / avg if avg > 0 else 0

    table = Table(title="Benchmark Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    table.add_row("Frames", str(frames))
    table.add_row("Avg Latency", f"{avg:.1f} ms")
    table.add_row("P50 Latency", f"{p50:.1f} ms")
    table.add_row("P99 Latency", f"{p99:.1f} ms")
    table.add_row("Throughput", f"{fps:.1f} FPS")
    rprint(table)
