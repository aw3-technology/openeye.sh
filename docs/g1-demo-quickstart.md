# Unitree G1 Safety Guardian — Event Demo Quickstart

30-second demo: a person walks toward the G1, OpenEye detects them, classifies the proximity zone, and halts the robot when they enter the danger zone.

## Setup Options

### Option A: Dry-Run (No Robot — Laptop Webcam)

```bash
# Pull the detection model
openeye pull yolov8

# Run the demo with your laptop webcam
openeye g1-demo
```

Walk in front of the webcam — the terminal shows zone classifications and simulated halt/resume commands.

### Option B: Real G1 Over Wi-Fi

```bash
# 1. Connect to the G1's Wi-Fi (SSID: usually "Unitree_G1_XXXX")
# 2. G1 default IP: 192.168.123.161

# Pull model
openeye pull yolov8

# Run with real robot control
openeye g1-demo \
    --transport rtsp \
    --control-mode sdk \
    --host 192.168.123.161
```

### Option C: G1 + Custom Safety Zones (Tight Demo Space)

```bash
openeye g1-demo \
    --transport rtsp \
    --control-mode sdk \
    --danger-m 0.8 \
    --caution-m 2.0 \
    --clear-duration 1.5
```

## What the Demo Shows

1. **Camera feed** from the G1's head camera (or webcam in dry-run)
2. **Real-time detection** of humans using YOLOv8
3. **Zone classification** — color-coded SAFE / CAUTION / DANGER
4. **Halt signal** — robot stops when a human enters the danger zone
5. **Auto-resume** — robot resumes after the workspace is clear for N seconds

## Architecture

```
G1 Head Camera (RealSense D435i)
    │
    ▼
┌─────────────────────────┐
│  OpenEye Perception     │
│  ┌───────────────────┐  │
│  │ YOLOv8 Detection  │  │
│  └────────┬──────────┘  │
│           ▼             │
│  ┌───────────────────┐  │
│  │ Safety Guardian   │  │
│  │ Zone Classifier   │  │
│  └────────┬──────────┘  │
└───────────┼─────────────┘
            ▼
┌─────────────────────────┐
│  G1 Connector           │
│  halt_recommended=True  │──▶ StopMove (SDK/HTTP)
│  workspace clear >2s    │──▶ Resume   (SDK/HTTP)
└─────────────────────────┘
```

## Requirements

```bash
pip install openeye-sh[camera]          # OpenCV for camera
pip install unitree-sdk2py              # Only for SDK control mode
```

## Fleet Deployment

To deploy Safety Guardian across a fleet of G1 robots:

```bash
# Register the G1
openeye fleet register \
    --name "g1-demo-01" \
    --site "event-floor" \
    --tags unitree-g1,safety-guardian

# Push the safety config to all G1 units
openeye fleet push-config \
    --target tag:unitree-g1 \
    --config configs/g1_safety_guardian.yaml
```

## CLI Reference

```
openeye g1-demo [OPTIONS]

Options:
  --transport     webcam|usb|rtsp|sdk|auto  (default: webcam)
  --host          G1 IP address             (default: 192.168.123.161)
  --control-mode  sdk|http|dry_run          (default: dry_run)
  --model         Detection model           (default: yolov8)
  --danger-m      Danger zone metres        (default: 0.5)
  --caution-m     Caution zone metres       (default: 1.5)
  --clear-duration Seconds before resume    (default: 2.0)
  --max-fps       Camera frame rate cap     (default: 15.0)
  --camera, -c    USB device index          (default: 0)
```
