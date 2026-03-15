"""FastAPI router for MLOps endpoints (stories 181-192)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile

from .schemas import (
    ABTestConfig,
    ABTestStatus,
    AnnotationLabel,
    BatchInferenceConfig,
    ExportFormat,
    ExportRequest,
    ModelFormat,
    ModelStage,
    ModelUploadRequest,
    PromotionRequest,
    RetrainingPipelineConfig,
    RetrainingTrigger,
    ShadowDeploymentConfig,
)

router = APIRouter(prefix="/mlops", tags=["mlops"])


# ── Story 181: Model Upload + Registration ────────────────────────────


@router.post("/models/upload")
async def upload_model(
    name: str,
    key: str,
    format: ModelFormat,
    task: str,
    file: UploadFile,
    description: str = "",
    author: str = "",
    adapter: str = "onnx_generic",
):
    """Upload a custom-trained model and register it."""
    import os
    import tempfile

    from .model_registry import upload_and_register

    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        request = ModelUploadRequest(
            name=name,
            key=key,
            format=format,
            task=task,
            description=description,
            author=author,
            file_path=tmp_path,
            adapter=adapter,
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
    from .model_registry import list_registered_models

    return [m.model_dump() for m in list_registered_models()]


@router.get("/models/{model_key}")
async def get_model(model_key: str):
    """Get a model from the enterprise registry."""
    from .model_registry import get_registered_model

    try:
        return get_registered_model(model_key).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models/{model_key}/versions")
async def get_model_versions(model_key: str):
    """List all versions of a model."""
    from .model_registry import list_versions

    try:
        return [v.model_dump() for v in list_versions(model_key)]
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/models/{model_key}/versions")
async def add_model_version(
    model_key: str,
    version: str,
    format: ModelFormat,
    file: UploadFile,
    author: str = "",
    changelog: str = "",
    training_dataset: str = "",
    code_commit: str = "",
):
    """Add a new version to an existing model."""
    import os
    import tempfile

    from .model_registry import add_version

    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        v = add_version(
            model_key,
            file_path=tmp_path,
            version=version,
            format=format,
            author=author,
            changelog=changelog,
            training_dataset=training_dataset,
            code_commit=code_commit,
        )
        return {"status": "ok", "version": v.model_dump()}
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Story 183: Stage Promotion ────────────────────────────────────────


@router.post("/models/{model_key}/promote")
async def promote_model(model_key: str, version: str, target_stage: ModelStage, requester: str, reason: str = ""):
    """Request to promote a model version to a new stage."""
    from .lifecycle import request_promotion

    try:
        req = PromotionRequest(
            model_key=model_key,
            version=version,
            target_stage=target_stage,
            requester=requester,
            reason=reason,
        )
        record = request_promotion(req)
        return record.model_dump()
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/models/{model_key}/promote/approve")
async def approve_model_promotion(model_key: str, version: str, approver: str):
    """Approve a pending promotion."""
    from .lifecycle import approve_promotion

    try:
        return approve_promotion(model_key, version, approver).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/models/{model_key}/promote/reject")
async def reject_model_promotion(model_key: str, version: str, approver: str, reason: str = ""):
    """Reject a pending promotion."""
    from .lifecycle import reject_promotion

    try:
        return reject_promotion(model_key, version, approver, reason).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/promotions")
async def get_promotions(model_key: Optional[str] = None):
    """List promotion records."""
    from .lifecycle import list_promotions

    return [p.model_dump() for p in list_promotions(model_key)]


# ── Story 184: A/B Testing ────────────────────────────────────────────


@router.post("/ab-tests")
async def create_ab_test_endpoint(config: ABTestConfig):
    """Create a new A/B test."""
    from .ab_testing import create_ab_test

    return create_ab_test(config).model_dump()


@router.get("/ab-tests")
async def list_ab_tests_endpoint(model_key: Optional[str] = None):
    """List A/B tests."""
    from .ab_testing import list_ab_tests

    return [t.model_dump() for t in list_ab_tests(model_key)]


@router.get("/ab-tests/{test_id}")
async def get_ab_test_endpoint(test_id: str):
    """Get an A/B test by ID."""
    from .ab_testing import get_ab_test

    try:
        return get_ab_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/ab-tests/{test_id}/complete")
async def complete_ab_test_endpoint(test_id: str):
    """Complete an A/B test and determine winner."""
    from .ab_testing import complete_ab_test

    try:
        return complete_ab_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Story 185: Retraining Pipelines ──────────────────────────────────


@router.post("/retraining/pipelines")
async def create_pipeline_endpoint(config: RetrainingPipelineConfig):
    """Create a new retraining pipeline."""
    from .retraining import create_pipeline

    try:
        return create_pipeline(config).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/retraining/pipelines")
async def list_pipelines_endpoint(model_key: Optional[str] = None):
    """List retraining pipelines."""
    from .retraining import list_pipelines

    return [p.model_dump() for p in list_pipelines(model_key)]


@router.post("/retraining/pipelines/{pipeline_name}/trigger")
async def trigger_retraining_endpoint(pipeline_name: str, triggered_by: str = "manual"):
    """Trigger a retraining run."""
    from .retraining import trigger_retraining

    try:
        return trigger_retraining(pipeline_name, triggered_by=triggered_by).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/retraining/runs")
async def list_runs_endpoint(pipeline_name: Optional[str] = None, model_key: Optional[str] = None):
    """List retraining runs."""
    from .retraining import list_runs

    return [r.model_dump() for r in list_runs(pipeline_name, model_key)]


@router.get("/retraining/runs/{run_id}")
async def get_run_endpoint(run_id: str):
    """Get a retraining run by ID."""
    from .retraining import get_run

    try:
        return get_run(run_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Story 186: Batch Inference ────────────────────────────────────────


@router.post("/batch-inference")
async def create_batch_job_endpoint(config: BatchInferenceConfig):
    """Create a batch inference job."""
    from .batch_inference import create_batch_job

    return create_batch_job(config).model_dump()


@router.get("/batch-inference")
async def list_batch_jobs_endpoint(model_key: Optional[str] = None):
    """List batch inference jobs."""
    from .batch_inference import list_batch_jobs

    return [j.model_dump() for j in list_batch_jobs(model_key)]


@router.get("/batch-inference/{job_id}")
async def get_batch_job_endpoint(job_id: str):
    """Get a batch job by ID."""
    from .batch_inference import get_batch_job

    try:
        return get_batch_job(job_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Story 187: Benchmark Matrix ───────────────────────────────────────


@router.get("/benchmarks/{model_key}")
async def get_benchmarks_endpoint(model_key: str, model_version: Optional[str] = None):
    """Get benchmark results for a model."""
    from .benchmark_matrix import get_benchmark_results

    return [b.model_dump() for b in get_benchmark_results(model_key, model_version)]


# ── Story 188: Validation Tests ───────────────────────────────────────


@router.post("/validation-tests")
async def create_validation_test_endpoint(
    name: str,
    model_key: str,
    test_dataset: str,
    conditions: list[str],
    description: str = "",
):
    """Create a validation test."""
    from .validation import create_validation_test

    try:
        return create_validation_test(name, model_key, test_dataset, conditions, description).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/validation-tests")
async def list_validation_tests_endpoint(model_key: Optional[str] = None):
    """List validation tests."""
    from .validation import list_validation_tests

    return [t.model_dump() for t in list_validation_tests(model_key)]


@router.get("/validation-tests/{test_id}")
async def get_validation_test_endpoint(test_id: str):
    """Get a validation test."""
    from .validation import get_validation_test

    try:
        return get_validation_test(test_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/validation-runs")
async def list_validation_runs_endpoint(test_id: Optional[str] = None, model_key: Optional[str] = None):
    """List validation test runs."""
    from .validation import list_validation_runs

    return [r.model_dump() for r in list_validation_runs(test_id, model_key)]


# ── Story 189: Model Lineage ─────────────────────────────────────────


@router.get("/lineage/{model_key}/{version}")
async def get_lineage_endpoint(model_key: str, version: str):
    """Get lineage for a model version."""
    from .lineage import get_lineage

    try:
        return get_lineage(model_key, version).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/lineage/{model_key}/{version}/chain")
async def get_lineage_chain_endpoint(model_key: str, version: str):
    """Get the full lineage chain for a model version."""
    from .lineage import get_lineage_chain

    return [l.model_dump() for l in get_lineage_chain(model_key, version)]


@router.get("/lineage")
async def list_lineage_endpoint(model_key: Optional[str] = None):
    """List all lineage records."""
    from .lineage import list_lineage

    return [l.model_dump() for l in list_lineage(model_key)]


# ── Story 190: Model Export ───────────────────────────────────────────


@router.post("/export")
async def export_model_endpoint(request: ExportRequest):
    """Export a model to ONNX, TensorRT, or CoreML."""
    from .export import export_model

    try:
        return export_model(request).model_dump()
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exports")
async def list_exports_endpoint(model_key: Optional[str] = None):
    """List model exports."""
    from .export import list_exports

    return [e.model_dump() for e in list_exports(model_key)]


# ── Story 191: Shadow Mode ───────────────────────────────────────────


@router.post("/shadow-deployments")
async def create_shadow_endpoint(config: ShadowDeploymentConfig):
    """Create a shadow mode deployment."""
    from .shadow_mode import create_shadow_deployment

    return create_shadow_deployment(config).model_dump()


@router.get("/shadow-deployments")
async def list_shadow_endpoint(model_key: Optional[str] = None):
    """List shadow deployments."""
    from .shadow_mode import list_shadow_deployments

    return [d.model_dump() for d in list_shadow_deployments(model_key)]


@router.get("/shadow-deployments/{deployment_id}")
async def get_shadow_endpoint(deployment_id: str):
    """Get a shadow deployment."""
    from .shadow_mode import get_shadow_deployment

    try:
        return get_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/shadow-deployments/{deployment_id}/complete")
async def complete_shadow_endpoint(deployment_id: str):
    """Complete a shadow deployment."""
    from .shadow_mode import complete_shadow_deployment

    try:
        return complete_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Story 192: Feedback / Annotations ────────────────────────────────


@router.post("/annotations")
async def create_annotation_endpoint(
    model_key: str,
    model_version: str,
    image_source: str,
    correct_label: str,
    annotation_label: AnnotationLabel,
    predicted_label: Optional[str] = None,
    predicted_confidence: Optional[float] = None,
    annotator: str = "",
    notes: str = "",
):
    """Annotate an inference failure."""
    from .feedback import annotate_failure

    return annotate_failure(
        model_key=model_key,
        model_version=model_version,
        image_source=image_source,
        correct_label=correct_label,
        annotation_label=annotation_label,
        predicted_label=predicted_label,
        predicted_confidence=predicted_confidence,
        annotator=annotator,
        notes=notes,
    ).model_dump()


@router.get("/annotations")
async def list_annotations_endpoint(
    model_key: Optional[str] = None,
    annotation_label: Optional[AnnotationLabel] = None,
    unfed_only: bool = False,
):
    """List annotations."""
    from .feedback import list_annotations

    return [a.model_dump() for a in list_annotations(model_key, annotation_label, unfed_only)]


@router.post("/feedback-batches")
async def create_feedback_batch_endpoint(
    model_key: str,
    output_dataset_path: str,
    annotation_ids: Optional[list[str]] = None,
):
    """Create and execute a feedback batch."""
    from .feedback import create_feedback_batch, execute_feedback_batch

    try:
        batch = create_feedback_batch(model_key, output_dataset_path, annotation_ids=annotation_ids)
        batch = execute_feedback_batch(batch.id)
        return batch.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/feedback-batches")
async def list_feedback_batches_endpoint(model_key: Optional[str] = None):
    """List feedback batches."""
    from .feedback import list_feedback_batches

    return [b.model_dump() for b in list_feedback_batches(model_key)]
