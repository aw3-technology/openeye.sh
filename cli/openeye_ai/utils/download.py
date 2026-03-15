"""HuggingFace download helpers."""

from __future__ import annotations

from pathlib import Path

from rich.progress import Progress, SpinnerColumn, TextColumn


def download_from_hf(repo_id: str, model_dir: Path, filename: str | None = None) -> Path:
    """Download a model from HuggingFace Hub to model_dir.

    Returns the path to the downloaded directory.
    """
    from huggingface_hub import snapshot_download

    model_dir.mkdir(parents=True, exist_ok=True)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task(f"Downloading {repo_id}...", total=None)
        path = snapshot_download(
            repo_id=repo_id,
            local_dir=str(model_dir),
            local_dir_use_symlinks=False,
            resume_download=True,
        )

    return Path(path)


def mark_pulled(model_dir: Path) -> None:
    """Create a .pulled marker file."""
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / ".pulled").touch()
