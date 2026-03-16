# Troubleshooting

Common issues and fixes when working with the OpenEye CLI.

---

## Missing Dependencies

**Symptom:** `Missing dependencies for '<model>': <package>`

Each model family requires its own extras. Install the one you need:

```bash
pip install "openeye-sh[yolo]"       # YOLOv8, YOLO26
pip install "openeye-sh[depth]"      # Depth Anything
pip install "openeye-sh[grounding]"  # Grounding DINO
pip install "openeye-sh[sam]"        # SAM 2
pip install "openeye-sh[rfdetr]"     # RF-DETR
pip install "openeye-sh[smolvla]"    # SmolVLA
```

With pipx:

```bash
pipx install "openeye-sh[yolo]" --force
```

!!! warning "Zsh / Fish shell quoting"
    Zsh and Fish interpret square brackets as glob patterns. You **must** quote the install target:

    ```bash
    # Correct
    pip install "openeye-sh[yolo]"

    # Wrong -- zsh will error
    pip install openeye-sh[yolo]
    ```

---

## Model Not Found

**Symptom:** `Unknown model '<name>'. Available: ...`

Models must be pulled before use. The CLI will list available models if you reference one that doesn't exist.

```bash
# List all available models
openeye list

# Pull a specific model
openeye pull yolov8

# Pull a specific variant
openeye pull yolov8 --variant yolov8s
```

If you see `Weights not found at <path>. Re-run: openeye pull <model>`, the model directory exists but weight files are missing or corrupt. Re-pull to fix:

```bash
openeye remove yolov8
openeye pull yolov8
```

---

## Camera / Video Issues

**Symptom:** `Cannot open camera <index>` or `Cannot open video file: <path>`

### Camera not detected

1. Verify the camera works outside OpenEye (e.g. Photo Booth on macOS, `cheese` on Linux).
2. Try a different index: `openeye watch yolov8 --camera 1`
3. On macOS, ensure Terminal has camera permission in **System Settings > Privacy & Security > Camera**.

### OpenCV not installed

Camera and video features require OpenCV:

```bash
pip install opencv-python-headless
```

Use `opencv-python-headless` in server/CI environments and `opencv-python` if you need GUI windows (`cv2.imshow`).

### Video file fallback

If your camera is unavailable, use a video file instead:

```bash
openeye watch yolov8 --video path/to/video.mp4
```

The CLI accepts any format OpenCV supports (MP4, AVI, MOV, etc.).

### Unitree G1 camera

The G1 camera auto-detects transports in this order: **SDK > USB > RTSP**. If connection fails:

- Ensure the G1 is powered on and connected
- Try forcing a specific transport: `--transport usb` or `--transport rtsp`
- For SDK transport, install `unitree-sdk2py`: `pip install unitree-sdk2py`

---

## Server Port Conflicts

**Symptom:** `Address already in use` or `OSError: [Errno 48]` when starting the server.

Another process is already bound to that port.

```bash
# Find what's using port 8000
lsof -i :8000

# Start on a different port
openeye serve yolov8 --port 8001
```

Valid port range is **1--65535**. Ports below 1024 require root on most systems.

---

## GPU / CUDA Not Detected

**Symptom:** Inference runs on CPU and is slower than expected.

OpenEye auto-detects hardware in this order: **CUDA > Apple MPS > CPU**.

### Check what the CLI sees

```bash
openeye bench yolov8
```

The benchmark output includes a `device` field (`CUDA`, `MPS`, or `CPU`).

### CUDA not available

1. Verify your NVIDIA driver: `nvidia-smi`
2. Install the CUDA-enabled PyTorch build:

    ```bash
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
    ```

3. Confirm in Python:

    ```python
    import torch
    print(torch.cuda.is_available())  # Should be True
    ```

### Apple Silicon (MPS)

MPS is used automatically on Apple Silicon Macs with PyTorch >= 1.13. If it's not detected, upgrade PyTorch:

```bash
pip install --upgrade torch torchvision
```

### Forcing CPU

If GPU inference is unstable, set the device explicitly in your adapter or pass `--device cpu` where supported.

---

## WebSocket Connection Failures

**Symptom:** Frontend cannot connect to the `/ws` endpoint, or connections drop immediately.

### CORS errors

The server allows these origins by default:

- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost:8080`

To add custom origins, set the `CORS_ORIGINS` environment variable:

```bash
CORS_ORIGINS="http://localhost:5173,https://myapp.example.com" openeye serve yolov8
```

### Firewall / network

- Ensure the server port is open in your firewall.
- When connecting from a different machine, use the server's IP, not `localhost`.

### URL format

WebSocket URLs must use the `ws://` or `wss://` scheme:

```
ws://localhost:8000/ws        # correct
http://localhost:8000/ws      # wrong
```

### Invalid image data

The WebSocket endpoint expects **base64-encoded image data**. If you send raw bytes or text, you'll receive:

```json
{"error": "Invalid image data. Send base64-encoded image."}
```

---

## Disk Space Errors

**Symptom:** `Insufficient disk space. Need ~<X> MB but only <Y> MB available.`

Before downloading, `openeye pull` checks that you have at least **2x the model size** in free disk space. The extra buffer covers temporary files during extraction.

To free space:

```bash
# See what's downloaded
openeye list

# Remove models you don't need
openeye remove depth-anything
```

If you're sure you have enough space (e.g. a compressed model that extracts smaller), remove an old model first to free the buffer.

---

## Permission Errors

**Symptom:** `PermissionError` when pulling models or writing config.

OpenEye stores all data under `~/.openeye/`:

```
~/.openeye/
  models/        # Downloaded model weights
  config.yaml    # User configuration
```

### Fix ownership

If the directory was created by a different user (e.g. root during a `sudo pip install`):

```bash
sudo chown -R $(whoami) ~/.openeye
```

### Fix permissions

```bash
chmod -R u+rwX ~/.openeye
```

### Avoid sudo

Never run `openeye pull` or `openeye serve` with `sudo`. Install OpenEye in a user-owned virtualenv or use pipx instead.
