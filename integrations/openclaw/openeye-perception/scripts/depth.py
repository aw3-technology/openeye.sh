#!/usr/bin/env python3
"""Run depth estimation on an image via the OpenEye Hosted API."""

import argparse
import base64
import json
import sys

from openeye_api import api_post_file, error

parser = argparse.ArgumentParser(description="Estimate depth from an image")
parser.add_argument("image", help="Path to image file")
parser.add_argument("--save-depth-map", metavar="PATH", help="Save depth map PNG to file")
args = parser.parse_args()

try:
    result = api_post_file("/v1/depth", args.image)
except FileNotFoundError:
    error(f"File not found: {args.image}")

if args.save_depth_map and "depth_map" in result:
    with open(args.save_depth_map, "wb") as f:
        f.write(base64.b64decode(result["depth_map"]))
    result["depth_map"] = f"<saved to {args.save_depth_map}>"

json.dump(result, sys.stdout, indent=2)
print()
