#!/usr/bin/env bash
# Check OpenEye installation and model status
set -euo pipefail

echo "=== OpenEye Health Check ==="

if ! command -v openeye &>/dev/null; then
  echo "ERROR: openeye not found. Install with: pip install openeye-ai[all]"
  exit 1
fi

echo "CLI: $(openeye --version 2>/dev/null || echo 'installed')"
echo ""
echo "=== Downloaded Models ==="
openeye list 2>/dev/null | head -30
echo ""
echo "=== Config ==="
openeye config get default_backend 2>/dev/null || echo "default"
