---
title: MLOps API
---

The MLOps API provides endpoints for model lifecycle management, A/B testing, retraining pipelines, batch inference, and more. All endpoints are prefixed with `/mlops`.

### Model Registry

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/models/upload | Upload and register a custom model |
| GET | /mlops/models | List all registered models |
| GET | /mlops/models/{key} | Get a model by registry key |
| GET | /mlops/models/{key}/versions | List all versions of a model |
| POST | /mlops/models/{key}/versions | Add a new version to an existing model |

### Stage Promotion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/models/{key}/promote | Request promotion to a new stage |
| POST | /mlops/models/{key}/promote/approve | Approve a pending promotion |
| POST | /mlops/models/{key}/promote/reject | Reject a pending promotion |
| GET | /mlops/promotions | List promotion records |

### A/B Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/ab-tests | Create an A/B test |
| GET | /mlops/ab-tests | List A/B tests |
| GET | /mlops/ab-tests/{id} | Get an A/B test by ID |
| POST | /mlops/ab-tests/{id}/complete | Complete an A/B test and determine winner |

### Retraining Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/retraining/pipelines | Create a retraining pipeline |
| GET | /mlops/retraining/pipelines | List pipelines |
| POST | /mlops/retraining/pipelines/{name}/trigger | Trigger a retraining run |
| GET | /mlops/retraining/runs | List retraining runs |
| GET | /mlops/retraining/runs/{id} | Get a retraining run by ID |

### Batch Inference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/batch-inference | Create a batch inference job |
| GET | /mlops/batch-inference | List batch jobs |
| GET | /mlops/batch-inference/{id} | Get a batch job by ID |

### Benchmarks & Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /mlops/benchmarks/{key} | Get benchmark results for a model |
| POST | /mlops/validation-tests | Create a validation test |
| GET | /mlops/validation-tests | List validation tests |
| GET | /mlops/validation-tests/{id} | Get a validation test |
| GET | /mlops/validation-runs | List validation test runs |

### Model Lineage

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /mlops/lineage/{key}/{version} | Get lineage for a model version |
| GET | /mlops/lineage/{key}/{version}/chain | Get full lineage chain |
| GET | /mlops/lineage | List all lineage records |

### Model Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/export | Export a model to ONNX, TensorRT, or CoreML |
| GET | /mlops/exports | List model exports |

### Shadow Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/shadow-deployments | Create a shadow mode deployment |
| GET | /mlops/shadow-deployments | List shadow deployments |
| GET | /mlops/shadow-deployments/{id} | Get a shadow deployment |
| POST | /mlops/shadow-deployments/{id}/complete | Complete a shadow deployment |

### Feedback & Annotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /mlops/annotations | Annotate an inference failure |
| GET | /mlops/annotations | List annotations |
| POST | /mlops/feedback-batches | Create and execute a feedback batch |
| GET | /mlops/feedback-batches | List feedback batches |
