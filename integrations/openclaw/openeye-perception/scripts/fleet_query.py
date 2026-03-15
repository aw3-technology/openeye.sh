#!/usr/bin/env python3
"""Query fleet devices and alerts via the OpenEye Fleet API."""

import argparse
import json
import sys

from openeye_api import error, fleet_get

parser = argparse.ArgumentParser(description="Query fleet devices and alerts")
sub = parser.add_subparsers(dest="command")

list_p = sub.add_parser("list", help="List devices")
list_p.add_argument("--status", help="Filter by status (online, offline, etc.)")
list_p.add_argument("--type", dest="device_type", help="Filter by type (camera, robot, etc.)")

get_p = sub.add_parser("get", help="Get device details")
get_p.add_argument("device_id", help="Device ID")

alerts_p = sub.add_parser("alerts", help="List fleet alerts")
alerts_p.add_argument("--severity", help="Filter by severity (info, warning, error, critical)")
alerts_p.add_argument("--unresolved", action="store_true", help="Show only unresolved alerts")

args = parser.parse_args()

if not args.command:
    parser.print_help()
    sys.exit(1)

if args.command == "list":
    params = {}
    if args.status:
        params["status"] = args.status
    if args.device_type:
        params["device_type"] = args.device_type
    result = fleet_get("/devices", params or None)

elif args.command == "get":
    result = fleet_get(f"/devices/{args.device_id}")

elif args.command == "alerts":
    params = {}
    if args.severity:
        params["severity"] = args.severity
    if args.unresolved:
        params["resolved"] = "false"
    result = fleet_get("/alerts", params or None)

json.dump(result, sys.stdout, indent=2)
print()
