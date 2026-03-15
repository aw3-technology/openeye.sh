#!/usr/bin/env python3
"""Describe an image scene via the OpenEye Hosted API."""

import argparse
import json
import sys

from openeye_api import api_post_file, error

parser = argparse.ArgumentParser(description="Describe what's in an image")
parser.add_argument("image", help="Path to image file")
parser.add_argument("--prompt", default="Describe what you see in this image.", help="Vision prompt")
args = parser.parse_args()

if len(args.prompt) > 2000:
    error("Prompt too long. Maximum length is 2000 characters.")

try:
    result = api_post_file("/v1/describe", args.image, {"prompt": args.prompt})
except FileNotFoundError:
    error(f"File not found: {args.image}")

json.dump(result, sys.stdout, indent=2)
print()
