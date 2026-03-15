#!/usr/bin/env python3
"""Check credit balance, usage stats, and available models."""

import argparse
import json
import sys

from openeye_api import api_get, error

parser = argparse.ArgumentParser(description="Check API usage and models")
sub = parser.add_subparsers(dest="command")

balance_p = sub.add_parser("balance", help="Get credit balance and usage stats")
balance_p.add_argument("--days", type=int, default=30, help="Usage history window in days (1-365)")

sub.add_parser("models", help="List available models and credit costs")

args = parser.parse_args()

if not args.command:
    parser.print_help()
    sys.exit(1)

if args.command == "balance":
    result = api_get("/v1/usage", {"days": args.days})
elif args.command == "models":
    result = api_get("/v1/models")

json.dump(result, sys.stdout, indent=2)
print()
