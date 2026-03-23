#!/usr/bin/env bash
# check-deps.sh — verify that required dev tools are installed
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

missing=0

check() {
  local cmd="$1"
  local label="${2:-$1}"
  local required="${3:-true}"

  if command -v "$cmd" &>/dev/null; then
    version=$("$cmd" --version 2>&1 | head -n1)
    printf "${GREEN}[OK]${NC}  %-10s %s\n" "$label" "$version"
  elif [ "$required" = "true" ]; then
    printf "${RED}[MISSING]${NC}  %-10s (required)\n" "$label"
    missing=1
  else
    printf "${YELLOW}[SKIP]${NC}  %-10s (optional, not found)\n" "$label"
  fi
}

echo "===== OpenEye monorepo dependency check ====="
echo ""

echo "-- Node / Frontend --"
check node   "node"
check npm    "npm"

echo ""
echo "-- Python / Backend & CLI --"
check python3 "python3"
check pip     "pip"
check uv      "uv"       false
check ruff    "ruff"

echo ""

if [ "$missing" -ne 0 ]; then
  printf "\n${RED}Some required tools are missing. Please install them before continuing.${NC}\n"
  exit 1
else
  printf "\n${GREEN}All required tools are available.${NC}\n"
  exit 0
fi
