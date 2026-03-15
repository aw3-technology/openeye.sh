#!/usr/bin/env bash
# Generate Python stubs from protobuf definitions.
# Usage: ./scripts/gen_proto.sh
#
# Requires: pip install grpcio-tools

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$PROJECT_ROOT/backend/src/perception_grpc"
OUT_DIR="$PROTO_DIR"

echo "Generating protobuf stubs..."

# Original (backward-compat)
python -m grpc_tools.protoc \
    -I "$PROTO_DIR" \
    --python_out="$OUT_DIR" \
    --grpc_python_out="$OUT_DIR" \
    "$PROTO_DIR/perception.proto"

# Full perception proto
python -m grpc_tools.protoc \
    -I "$PROTO_DIR" \
    --python_out="$OUT_DIR" \
    --grpc_python_out="$OUT_DIR" \
    "$PROTO_DIR/openeye_perception.proto"

echo "Done. Generated stubs in $OUT_DIR"
