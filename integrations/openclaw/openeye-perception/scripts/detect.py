#!/usr/bin/env python3
"""Run object detection on an image via the OpenEye Hosted API."""

import argparse
import json
import sys

from openeye_api import api_post_file, error

parser = argparse.ArgumentParser(description="Detect objects in an image")
parser.add_argument("image", help="Path to image file")
parser.add_argument("--confidence", type=float, default=0.25, help="Min confidence threshold (0-1)")
args = parser.parse_args()

try:
    result = api_post_file("/v1/detect", args.image, {"confidence": str(args.confidence)})
except FileNotFoundError:
    error(f"File not found: {args.image}")

json.dump(result, sys.stdout, indent=2)
print()
