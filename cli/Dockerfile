# ---- Builder ----
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY openeye_ai/ openeye_ai/

RUN pip install --no-cache-dir ".[yolo]"

# Pre-pull yolov8 model weights
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# ---- Runtime ----
FROM python:3.13-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin/openeye /usr/local/bin/openeye
COPY --from=builder /build/openeye_ai /app/openeye_ai

# Copy pre-pulled model weights
COPY --from=builder /root/.openeye /root/.openeye

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); r.raise_for_status()" || exit 1

ENTRYPOINT ["openeye"]
CMD ["serve", "yolov8"]
