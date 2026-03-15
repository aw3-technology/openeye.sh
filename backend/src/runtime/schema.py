import json
import logging
from pathlib import Path

from jsonschema import ValidationError, validate


def _load_schema(schema_file: str) -> dict:
    schema_path = Path(__file__).parent / "../../config/schema" / schema_file
    if not schema_path.exists():
        raise FileNotFoundError(
            f"Schema file not found: {schema_path}. Cannot validate configuration."
        )
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_config_schema(raw_config: dict) -> None:
    schema_file = (
        "multi_mode_schema.json"
        if "modes" in raw_config and "default_mode" in raw_config
        else "single_mode_schema.json"
    )
    try:
        schema = _load_schema(schema_file)
        validate(instance=raw_config, schema=schema)
    except FileNotFoundError as e:
        logging.error(str(e))
        raise
    except ValidationError as e:
        field_path = ".".join(str(p) for p in e.path) if e.path else "root"
        logging.error(f"Schema validation failed at field '{field_path}': {e.message}")
        raise
