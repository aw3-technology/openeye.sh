"""Routes for Story 181-182: Model Upload, Registration, and Versions."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile

from ..schemas import ModelFormat, ModelUploadRequest

router = APIRouter()


# ── Story 181: Model Upload + Registration ────────────────────────────

@router.post("/models/upload")
async def upload_model(
    name: str, key: str, format: ModelFormat, task: str, file: UploadFile,
    description: str = "", author: str = "", adapter: str = "onnx_generic",
):
    """Upload a custom-trained model and register it."""
    import os
    import tempfile
    from ..model_registry import upload_and_register
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        request = ModelUploadRequest(
            name=name, key=key, format=format, task=task,
            description=description, author=author, file_path=tmp_path, adapter=adapter,
        )
        version = upload_and_register(request)
        return {"status": "ok", "version": version.model_dump()}
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Story 182: Model Registry + Versions ──────────────────────────────

@router.get("/models")
async def list_models():
    """List all models in the enterprise registry."""
    from ..model_registry import list_registered_models
    return [m.model_dump() for m in list_registered_models()]

@router.get("/models/{model_key}")
async def get_model(model_key: str):
    """Get a model from the enterprise registry."""
    from ..model_registry import get_registered_model
    try:
        return get_registered_model(model_key).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/models/{model_key}/versions")
async def get_model_versions(model_key: str):
    """List all versions of a model."""
    from ..model_registry import list_versions
    try:
        return [v.model_dump() for v in list_versions(model_key)]
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/models/{model_key}/versions")
async def add_model_version(
    model_key: str, version: str, format: ModelFormat, file: UploadFile,
    author: str = "", changelog: str = "", training_dataset: str = "", code_commit: str = "",
):
    """Add a new version to an existing model."""
    import os
    import tempfile
    from ..model_registry import add_version
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        v = add_version(
            model_key, file_path=tmp_path, version=version, format=format,
            author=author, changelog=changelog, training_dataset=training_dataset, code_commit=code_commit,
        )
        return {"status": "ok", "version": v.model_dump()}
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
