# Docker Deployment

OpenEye includes a Dockerfile for containerized deployment.

## Build the Image

```bash
cd cli
docker build -t openeye .
```

This creates a multi-stage image that:

1. Installs dependencies and YOLO support
2. Pre-pulls the YOLOv8 model weights
3. Creates a slim runtime image

## Run the Container

### List models

```bash
docker run --rm openeye list
```

### Start the server

```bash
docker run --rm -p 8000:8000 openeye serve yolov8
```

### Run inference on a file

```bash
docker run --rm -v $(pwd)/images:/data openeye run yolov8 /data/photo.jpg
```

## Health Check

The container includes a built-in health check that polls `/health` every 30 seconds.

## Configuration

### Custom port

```bash
docker run --rm -p 9000:9000 openeye serve yolov8 --port 9000
```

### GPU support

```bash
docker run --rm --gpus all -p 8000:8000 openeye serve yolov8
```

Requires the NVIDIA Container Toolkit.

## Docker Compose Example

```yaml
services:
  openeye:
    build: ./cli
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```
