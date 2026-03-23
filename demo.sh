#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  OpenEye CLI Demo — "Ollama for Vision AI"
#  Run:  ./demo.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
OPENEYE="$VENV/bin/openeye"
DEMO_IMAGES="$SCRIPT_DIR/src/assets/demo"
OUTPUT_DIR="$SCRIPT_DIR/demo_output"

# Colors
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
DIM='\033[2m'
RESET='\033[0m'

banner() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${CYAN}${BOLD}  $1${RESET}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
}

step() {
    echo -e "${GREEN}${BOLD}>>> $1${RESET}"
    echo -e "${DIM}    $ $2${RESET}"
    echo ""
}

pause() {
    echo ""
    echo -e "${YELLOW}    Press Enter to continue...${RESET}"
    read -r
}

# ── Preflight ───────────────────────────────────────────────
if [[ ! -x "$OPENEYE" ]]; then
    echo "Error: openeye not found at $OPENEYE"
    echo "Run:  python3.12 -m venv .venv && .venv/bin/pip install -e './cli[yolo,camera]'"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Suppress the NNPACK warning for cleaner output
export PYTHONWARNINGS="ignore"

# ── Title ───────────────────────────────────────────────────
clear
echo ""
echo -e "${CYAN}${BOLD}"
cat << 'EOF'
     ___                   _____
    / _ \ _ __   ___ _ __ | ____|   _  ___
   | | | | '_ \ / _ \ '_ \|  _|| | | |/ _ \
   | |_| | |_) |  __/ | | | |__| |_| |  __/
    \___/| .__/ \___|_| |_|_____\__, |\___|
         |_|                    |___/
EOF
echo -e "${RESET}"
echo -e "${BOLD}    Ollama for Vision AI — pull, run, and serve${RESET}"
echo -e "${DIM}    computer-vision models from your terminal.${RESET}"
echo ""
echo -e "    ${DIM}Demo images: scene-warehouse.jpg, scene-kitchen.jpg,${RESET}"
echo -e "    ${DIM}             scene-workshop.jpg, safety-workspace.jpg${RESET}"
pause

# ── Step 1: List Models ─────────────────────────────────────
banner "Step 1: List Available Models"
step "See what models are available in the registry" "openeye list"
"$OPENEYE" list
pause

# ── Step 2: Pull a Model ────────────────────────────────────
banner "Step 2: Pull a Model"
step "Download YOLOv8 (6MB) — like 'ollama pull llama3'" "openeye pull yolov8"

if "$OPENEYE" list 2>&1 | grep -q "yolov8.*download"; then
    "$OPENEYE" pull yolov8 2>/dev/null || echo -e "${DIM}    (pull failed)${RESET}"
else
    echo -e "${DIM}    (yolov8 already downloaded, skipping pull)${RESET}"
fi
echo ""
echo -e "${GREEN}    Model pulled to ~/.openeye/models/yolov8/${RESET}"
pause

# ── Step 3: Run Inference on an Image ───────────────────────
banner "Step 3: Run Inference — Warehouse Scene"
step "Detect objects in a warehouse photo" "openeye run yolov8 scene-warehouse.jpg --pretty"
"$OPENEYE" run yolov8 "$DEMO_IMAGES/scene-warehouse.jpg" --pretty 2>/dev/null
pause

# ── Step 4: Run on Kitchen Scene ────────────────────────────
banner "Step 4: Run Inference — Kitchen Scene"
step "Detect objects in a kitchen photo" "openeye run yolov8 scene-kitchen.jpg --pretty"
"$OPENEYE" run yolov8 "$DEMO_IMAGES/scene-kitchen.jpg" --pretty 2>/dev/null
pause

# ── Step 5: Visualize with Bounding Boxes ───────────────────
banner "Step 5: Visualize — Save Annotated Image"
step "Run detection and save image with bounding boxes drawn" \
     "openeye run yolov8 scene-warehouse.jpg --visualize"
VIZ_OUTPUT=$("$OPENEYE" run yolov8 "$DEMO_IMAGES/scene-warehouse.jpg" --visualize 2>/dev/null) || true
echo "$VIZ_OUTPUT" | head -1
echo ""

ANNOTATED="$DEMO_IMAGES/scene-warehouse_annotated.png"
if [[ -f "$ANNOTATED" ]]; then
    mv "$ANNOTATED" "$OUTPUT_DIR/"
    echo -e "${GREEN}    Saved: demo_output/scene-warehouse_annotated.png${RESET}"
fi
pause

# ── Step 6: Pipe-Friendly — JSON to jq ─────────────────────
banner "Step 6: Unix Pipeline — Pipe to jq"
step "Extract just labels and confidence scores" \
     "openeye run yolov8 scene-kitchen.jpg | jq '.objects[] | {label, confidence}'"

if command -v jq &>/dev/null; then
    "$OPENEYE" run yolov8 "$DEMO_IMAGES/scene-kitchen.jpg" 2>/dev/null \
        | jq '.objects[] | {label, confidence}'
else
    echo -e "${DIM}    (jq not installed — showing raw JSON instead)${RESET}"
    "$OPENEYE" run yolov8 "$DEMO_IMAGES/scene-kitchen.jpg" --pretty 2>/dev/null
fi
pause

# ── Step 7: Benchmark ──────────────────────────────────────
banner "Step 7: Benchmark Model Performance"
step "Measure inference speed (5 runs)" "openeye bench yolov8 --warmup 2 --runs 5"
"$OPENEYE" bench yolov8 --warmup 2 --runs 5 2>/dev/null
pause

# ── Step 8: Serve with REST API ────────────────────────────
banner "Step 8: Serve — Start an API Server"
step "Launch a FastAPI server with REST + WebSocket endpoints" \
     "openeye serve yolov8 --port 8000"
echo -e "${DIM}    This starts a server with:${RESET}"
echo -e "${DIM}      POST /predict       — REST inference endpoint${RESET}"
echo -e "${DIM}      WS   /ws            — WebSocket streaming${RESET}"
echo -e "${DIM}      GET  /              — Browser dashboard${RESET}"
echo -e "${DIM}      GET  /metrics       — Prometheus metrics${RESET}"
echo ""

echo -e "${YELLOW}    Starting server for 10 seconds...${RESET}"
"$OPENEYE" serve yolov8 --port 8111 2>/dev/null &
SERVER_PID=$!
# Clean up server on script exit
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
# Wait for server to be ready (up to 10 seconds)
for _i in $(seq 1 20); do
    curl -s http://localhost:8111/ >/dev/null 2>&1 && break
    sleep 0.5
done

# Hit the predict endpoint
echo ""
step "Send an image to the REST API" \
     "curl -X POST http://localhost:8111/predict -F 'file=@scene-kitchen.jpg'"

if command -v curl &>/dev/null; then
    RESPONSE=$(curl -s -X POST "http://localhost:8111/predict" \
        -F "file=@$DEMO_IMAGES/scene-kitchen.jpg" 2>/dev/null || echo '{"error": "server not ready"}')
    if command -v jq &>/dev/null; then
        echo "$RESPONSE" | jq '.objects[] | {label, confidence}' 2>/dev/null || echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    else
        echo "$RESPONSE"
    fi
fi

echo ""
echo -e "${DIM}    Stopping server...${RESET}"
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
trap - EXIT INT TERM  # Remove trap now that server is stopped
echo -e "${GREEN}    Server stopped.${RESET}"
pause

# ── Step 9: Multi-Image Batch ──────────────────────────────
banner "Step 9: Batch Processing — All Demo Images"
step "Run detection across all demo images" \
     "for img in src/assets/demo/*.jpg; do openeye run yolov8 \$img; done"

for img in "$DEMO_IMAGES"/*.jpg; do
    BASENAME=$(basename "$img")
    RESULT=$("$OPENEYE" run yolov8 "$img" 2>/dev/null)
    COUNT=$(echo "$RESULT" | jq '.objects | length' 2>/dev/null || echo "?")
    LATENCY=$(echo "$RESULT" | jq '.inference_ms' 2>/dev/null || echo "?")
    LABELS=$(echo "$RESULT" | jq -r '[.objects[].label] | join(", ")' 2>/dev/null || echo "")
    printf "    %-25s  %s objects  %s ms  [%s]\n" "$BASENAME" "$COUNT" "$LATENCY" "$LABELS"
done
pause

# ── Wrap Up ─────────────────────────────────────────────────
banner "Demo Complete"
echo -e "    ${BOLD}What you saw:${RESET}"
echo ""
echo -e "    ${GREEN}1.${RESET} openeye list          — Browse the model registry"
echo -e "    ${GREEN}2.${RESET} openeye pull yolov8   — Download models (like ollama pull)"
echo -e "    ${GREEN}3.${RESET} openeye run           — Single-image inference to JSON"
echo -e "    ${GREEN}4.${RESET} openeye run --visualize — Save annotated images"
echo -e "    ${GREEN}5.${RESET} Unix pipes            — Compose with jq, scripts, etc."
echo -e "    ${GREEN}6.${RESET} openeye bench         — Benchmark model performance"
echo -e "    ${GREEN}7.${RESET} openeye serve         — REST API + WebSocket server"
echo -e "    ${GREEN}8.${RESET} Batch processing      — Run across multiple images"
echo ""
echo -e "    ${BOLD}Not shown (try yourself):${RESET}"
echo ""
echo -e "    ${DIM}openeye watch                — Live camera detection${RESET}"
echo -e "    ${DIM}openeye watch --safety       — Safety Guardian overlay${RESET}"
echo -e "    ${DIM}openeye g1-demo              — Unitree G1 robot safety demo${RESET}"
echo -e "    ${DIM}openeye agent run            — Agentic perception loop${RESET}"
echo -e "    ${DIM}openeye fleet                — Edge device fleet management${RESET}"
echo ""
echo -e "    ${CYAN}${BOLD}https://perceptify.dev${RESET}"
echo ""
