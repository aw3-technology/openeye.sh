"""Demo commands -- g1-demo."""

from __future__ import annotations

from typing import Optional

import typer


def g1_demo(
    transport: str = typer.Option("webcam", help="Camera: webcam, usb, rtsp, sdk, auto"),
    host: str = typer.Option("192.168.123.161", help="G1 IP address"),
    camera_index: int = typer.Option(0, "--camera", "-c", help="USB camera device index"),
    control_mode: str = typer.Option("dry_run", "--control-mode", help="Robot control: sdk, http, dry_run"),
    model: str = typer.Option("yolov8", "--model", "-m", help="Detection model"),
    danger_m: float = typer.Option(0.5, "--danger-m", help="Danger zone threshold (metres)"),
    caution_m: float = typer.Option(1.5, "--caution-m", help="Caution zone threshold (metres)"),
    clear_duration: float = typer.Option(2.0, "--clear-duration", help="Seconds clear before resume"),
    max_fps: float = typer.Option(15.0, "--max-fps", help="Max frame rate from camera"),
    video: Optional[str] = typer.Option(None, "--video", "-v", help="Video file path (fallback if camera fails)"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up model before starting for zero cold-start"),
) -> None:
    """Run the Unitree G1 Safety Guardian demo.

    Wires: G1 Camera -> OpenEye Detection -> Safety Guardian -> G1 Halt Signal.
    Use --transport webcam (default) for dry-run with laptop camera.
    Use --video <path> to use a pre-recorded video file instead of a live camera.
    Use --demo to warm up the model before starting for zero cold-start latency.
    """
    import argparse

    from openeye_ai.demos.g1_safety_demo import run_demo

    args = argparse.Namespace(
        transport=transport,
        host=host,
        camera_index=camera_index,
        control_mode=control_mode,
        model=model,
        danger_m=danger_m,
        caution_m=caution_m,
        clear_duration=clear_duration,
        max_fps=max_fps,
        video=video,
        demo=demo,
    )
    run_demo(args)


def vlm_demo(
    image: str = typer.Option("src/assets/demo/scene-warehouse.jpg", "--image", help="Path to image file"),
    model: str = typer.Option("qwen/qwen3-vl-235b:free", "--model", "-m", help="OpenRouter model ID"),
    prompt: str = typer.Option(
        "Describe what you see in this image in detail. "
        "Focus on objects, people, spatial layout, and any notable activities or hazards.",
        "--prompt", "-p",
        help="Custom prompt to send with the image",
    ),
    all_models: bool = typer.Option(False, "--all-models", help="Compare all free VLM models side-by-side"),
) -> None:
    """Run a VLM (Vision Language Model) demo via OpenRouter.

    Sends an image to a free VLM on OpenRouter and displays the reasoning.
    Use --all-models to compare Qwen3-VL, Qwen2.5-VL, and Gemma 3 side-by-side.
    """
    import argparse

    from openeye_ai.demos.vlm_openrouter_demo import run_demo as run_vlm_demo

    args = argparse.Namespace(
        image=image,
        model=model,
        prompt=prompt,
        all_models=all_models,
    )
    run_vlm_demo(args)
