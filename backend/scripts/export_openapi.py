"""Export the OpenAPI schema from the Fleet FastAPI app to backend/openapi.json.

Usage:
    cd backend && python -m scripts.export_openapi
"""

import json
import sys
from pathlib import Path

from src.fleet.app import create_fleet_app


def main() -> None:
    app = create_fleet_app()
    schema = app.openapi()

    out_path = Path(__file__).resolve().parent.parent / "openapi.json"
    out_path.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(f"OpenAPI schema written to {out_path}")


if __name__ == "__main__":
    main()
