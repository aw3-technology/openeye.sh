"""Shared API client for OpenEye Hosted Inference API."""

import json
import os
import sys

import requests

API_KEY = os.environ.get("OPENEYE_API_KEY", "")
API_URL = os.environ.get("OPENEYE_API_URL", "https://api.openeye.ai").rstrip("/")
FLEET_TOKEN = os.environ.get("OPENEYE_FLEET_TOKEN", "")

# Exit codes
EXIT_OK = 0
EXIT_CLIENT = 1
EXIT_AUTH = 2
EXIT_PAYMENT = 3
EXIT_RATE_LIMIT = 4
EXIT_SERVER = 5

_STATUS_TO_EXIT = {401: EXIT_AUTH, 402: EXIT_PAYMENT, 413: EXIT_CLIENT, 429: EXIT_RATE_LIMIT}


def require_api_key():
    if not API_KEY:
        error("OPENEYE_API_KEY environment variable is not set.", EXIT_CLIENT)


def require_fleet_token():
    if not FLEET_TOKEN:
        error("OPENEYE_FLEET_TOKEN environment variable is not set.", EXIT_CLIENT)


def error(message: str, code: int = EXIT_CLIENT):
    json.dump({"error": message}, sys.stderr)
    sys.stderr.write("\n")
    sys.exit(code)


def _handle_response(resp: requests.Response) -> dict:
    if resp.ok:
        return resp.json()
    code = _STATUS_TO_EXIT.get(resp.status_code, EXIT_SERVER if resp.status_code >= 500 else EXIT_CLIENT)
    try:
        body = resp.json()
        msg = body.get("detail") or body.get("message") or body.get("error") or resp.text
    except Exception:
        msg = resp.text or resp.reason
    error(f"HTTP {resp.status_code}: {msg}", code)


def api_post_file(path: str, filepath: str, extra_fields: dict | None = None) -> dict:
    """POST a file via multipart upload with X-API-Key auth."""
    require_api_key()
    url = f"{API_URL}{path}"
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        data = extra_fields or {}
        resp = requests.post(url, files=files, data=data, headers={"X-API-Key": API_KEY}, timeout=120)
    return _handle_response(resp)


def api_get(path: str, params: dict | None = None) -> dict:
    """GET with X-API-Key auth."""
    require_api_key()
    url = f"{API_URL}{path}"
    resp = requests.get(url, params=params, headers={"X-API-Key": API_KEY}, timeout=30)
    return _handle_response(resp)


def fleet_get(path: str, params: dict | None = None) -> dict | list:
    """GET with Bearer JWT auth for fleet endpoints."""
    require_fleet_token()
    url = f"{API_URL}{path}"
    resp = requests.get(url, params=params, headers={"Authorization": f"Bearer {FLEET_TOKEN}"}, timeout=30)
    return _handle_response(resp)
