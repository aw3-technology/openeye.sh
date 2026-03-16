# MLOps Workflow Guide

End-to-end guide for managing the model lifecycle with `openeye mlops` — from uploading a custom model through production deployment, testing, and automated retraining.

## Prerequisites

- OpenEye CLI installed (`pip install openeye-ai`)
- A trained model file (ONNX, TorchScript, or SafeTensors format)
- A test image or dataset for validation

## 1. Upload a Custom Model

Register a custom-trained model into the OpenEye enterprise registry:

```bash
openeye mlops upload ./my_detector.onnx \
  --name "Warehouse Detector v1" \
  --key warehouse-detector \
  --format onnx \
  --task detection \
  --author "ml-team" \
  --description "Detects pallets, forklifts, and workers" \
  --adapter onnx_generic
```

| Flag | Description |
|------|-------------|
| `--name` / `-n` | Human-readable model name |
| `--key` / `-k` | Unique registry key used in all subsequent commands |
| `--format` / `-f` | Weight format: `onnx`, `torchscript`, or `safetensors` |
| `--task` / `-t` | Task type (default: `detection`) |
| `--adapter` | Adapter to use for inference (default: `onnx_generic`) |

Verify the upload:

```bash
openeye mlops registry
```

## 2. Version Tracking

Each upload creates a new version. List all versions of a model:

```bash
openeye mlops versions warehouse-detector
```

Output shows version IDs, creation timestamps, current stage, and metadata. Use the version ID in promotion, export, and testing commands.

View the full provenance chain for any version:

```bash
openeye mlops lineage warehouse-detector v1
```

This displays the dataset, git commit, framework, and hyperparameters used to produce the version.

## 3. Stage Promotion

Models progress through stages: **dev** &rarr; **staging** &rarr; **production** &rarr; **archived**.

Promote a version to staging:

```bash
openeye mlops promote warehouse-detector v1 staging \
  --requester "ml-team" \
  --reason "Passed offline eval with 96% mAP"
```

For production promotion, an approval gate is enforced. A reviewer must approve:

```bash
# Reviewer approves
openeye mlops approve warehouse-detector v1 --approver "lead-eng"

# Or rejects with reason
openeye mlops reject warehouse-detector v1 \
  --approver "lead-eng" \
  --reason "Latency regression on Jetson"
```

Then promote to production:

```bash
openeye mlops promote warehouse-detector v1 production \
  --requester "ml-team"
```

## 4. Export for Edge Deployment

Convert a model version to an optimized edge format:

```bash
openeye mlops export warehouse-detector v1 tensorrt \
  --output ./deploy/warehouse-detector.trt \
  --quantize
```

| Format | Use Case | Target Hardware |
|--------|----------|-----------------|
| `onnx` | Cross-platform, general purpose | CPU, GPU (via ONNX Runtime) |
| `tensorrt` | Low-latency GPU inference | NVIDIA Jetson, T4, A100 |
| `coreml` | On-device Apple inference | iPhone, iPad, Mac (ANE) |

### SafeTensors Models

Models stored in SafeTensors format (`.safetensors`) are fully supported for export. The export pipeline automatically resolves the model architecture using one of two strategies:

1. **Companion file** — if a TorchScript `.pt` file exists alongside the `.safetensors` weights, it is used directly.
2. **Adapter reconstruction** — otherwise, the model's registered adapter loads the architecture and weights together.

No extra flags are needed; the `model_key` from the registry is passed automatically.

```bash
# Works even when the stored file is .safetensors
openeye mlops export warehouse-detector v1 onnx
```

### Quantization

The `--quantize` flag applies dynamic INT8 quantization (ONNX format only). This typically reduces model size by ~4x with minimal accuracy impact for detection workloads.

```bash
openeye mlops export warehouse-detector v1 onnx --quantize
```

The quantized file is saved alongside the original with an `_int8` suffix.

List all exports:

```bash
openeye mlops exports --model warehouse-detector
```

## 5. Batch Inference on Datasets

Process a directory of images (or a cloud bucket) in bulk:

```bash
openeye mlops batch warehouse-detector v1 ./test-images/ ./results/ \
  --batch-size 32 \
  --workers 4 \
  --format jsonl
```

| Flag | Description |
|------|-------------|
| `--batch-size` | Images per batch (default: 32) |
| `--workers` | Parallel I/O workers (default: 4) |
| `--format` | Output format: `jsonl` or `csv` |

### Cloud Storage (S3 / GCS)

Input and output paths can be local directories or cloud URIs. The CLI downloads images on the fly and uploads results when finished.

```bash
# Read from S3, write results to S3
openeye mlops batch warehouse-detector v1 \
  s3://my-bucket/images/ s3://my-bucket/results/ \
  --workers 8 --format jsonl

# Read from GCS, write results locally
openeye mlops batch warehouse-detector v1 \
  gs://my-bucket/frames/ ./local-results/ \
  --format csv
```

**Authentication** — configure credentials before running cloud jobs:

| Backend | Required Setup |
|---------|---------------|
| S3 | `aws configure` or set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| GCS | `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` |

### Output Formats

- **jsonl** — one JSON object per image, includes all detections and metadata. Best for downstream pipelines.
- **csv** — flat tabular output. Best for quick analysis in spreadsheets or pandas.

### Tuning Workers

The `--workers` flag controls I/O parallelism (image download + preprocessing). For local datasets, 4 workers is usually sufficient. For cloud storage with high latency, increase to 8-16.

## 6. A/B Testing

Compare two model versions by splitting traffic between them:

```bash
openeye mlops ab-test warehouse-detector \
  --a v1 \
  --b v2 \
  --name "v2-accuracy-test" \
  --split 0.3 \
  --max-samples 5000
```

This sends 30% of requests to version `v2` (challenger) and 70% to `v1` (control). The test stops automatically after 5,000 samples.

Check results:

```bash
openeye mlops ab-status warehouse-detector
```

## 7. Shadow Mode

Run a new model version alongside production without affecting users. The shadow model receives the same inputs and its predictions are logged for comparison, but only the production model's output is served:

```bash
openeye mlops shadow warehouse-detector \
  --prod v1 \
  --shadow v2 \
  --sample-rate 0.5 \
  --max-samples 10000
```

| Flag | Description |
|------|-------------|
| `--prod` | Current production version |
| `--shadow` | Candidate version to evaluate |
| `--sample-rate` | Fraction of requests to shadow (default: 1.0) |
| `--max-samples` | Stop after N samples (optional) |

Monitor the shadow deployment:

```bash
openeye mlops shadow-status warehouse-detector
```

## 8. Feedback Loop

When the model makes mistakes, annotate them to build a correction dataset.

### Submit an Annotation

```bash
openeye mlops annotate warehouse-detector v1 ./misdetected.jpg \
  --label forklift \
  --type misclassification \
  --predicted pallet \
  --annotator "safety-reviewer" \
  --notes "Occluded forklift near dock door"
```

Annotation types: `false_positive`, `false_negative`, `misclassification`, `wrong_bbox`, `low_confidence`.

### Generate a Feedback Batch

Bundle annotations into a correction dataset for retraining:

```bash
openeye mlops feedback warehouse-detector ./feedback-batch/
```

### Browse Annotations

```bash
# All annotations for a model
openeye mlops annotations --model warehouse-detector

# Filter by type
openeye mlops annotations --model warehouse-detector --label misclassification

# Show only annotations not yet included in a feedback batch
openeye mlops annotations --model warehouse-detector --unfed

# List feedback batches
openeye mlops feedback-batches --model warehouse-detector
```

## 9. Automated Retraining

### Create a Retraining Pipeline

Define a pipeline that links a model, training script, dataset, and optional schedule:

```bash
openeye mlops pipeline-create \
  --name "warehouse-nightly" \
  --model warehouse-detector \
  --script ./train/retrain.py \
  --dataset ./data/warehouse/ \
  --schedule "0 2 * * *"
```

The `--schedule` flag accepts a cron expression (this example runs at 2 AM daily).

### Trigger a Retraining Run

```bash
openeye mlops retrain warehouse-nightly --by "ci-bot"
```

### Monitor Pipelines and Runs

```bash
# List pipelines
openeye mlops pipelines
openeye mlops pipelines --model warehouse-detector

# List runs
openeye mlops runs --pipeline warehouse-nightly
openeye mlops runs --model warehouse-detector

# Check a specific run
openeye mlops run-status <run-id>
```

## Putting It All Together

A typical production workflow:

1. **Train** a model offline and **upload** it to the registry
2. **Validate** with batch inference on a held-out dataset
3. **Promote** to staging and run **shadow mode** against production
4. Review shadow results, **approve** and **promote** to production
5. Run an **A/B test** to confirm real-world performance
6. Collect **feedback** from operators on misdetections
7. Bundle feedback and **retrain** on the corrected dataset
8. **Export** the new version for edge deployment
9. Repeat

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────────┐
│  Train   │───▶│  Upload   │───▶│ Validate │───▶│  Promote   │
└─────────┘    └──────────┘    └─────────┘    │  (staging)  │
                                               └──────┬─────┘
                                                      │
                              ┌────────────┐    ┌─────▼─────┐
                              │  Promote    │◀───│  Shadow /  │
                              │ (production)│    │  A/B Test  │
                              └──────┬──────┘    └───────────┘
                                     │
                    ┌────────────┐    │    ┌───────────┐
                    │  Feedback  │◀───┴───▶│  Export    │
                    │  + Retrain │         │  (edge)   │
                    └────────────┘         └───────────┘
```
