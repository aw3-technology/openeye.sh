#!/usr/bin/env python3
"""Generate TypeScript interfaces from Pydantic models.

Usage:
    python scripts/sync-types.py

Reads backend/src/perception/models.py and cli/openeye_ai/schema.py,
then overwrites src/types/openeye.generated.ts with matching TS types.
Manual edits go in src/types/openeye.ts — it re-exports from the
generated file so downstream imports stay stable.

Requires: pip install pydantic  (already in both packages)
"""

from __future__ import annotations

import importlib
import inspect
import sys
from datetime import datetime
from enum import Enum
from pathlib import Path
from types import NoneType, UnionType
from typing import Any, Literal, Optional, Union, get_args, get_origin

# -- Bootstrap module paths ---------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
BACKEND_SRC = ROOT / "backend" / "src"
CLI_SRC = ROOT / "cli"

for p in (str(BACKEND_SRC), str(CLI_SRC)):
    if p not in sys.path:
        sys.path.insert(0, p)

OUTPUT = ROOT / "src" / "types" / "openeye.generated.ts"

# -- Python → TS type mapping --------------------------------------------------

_SCALAR_MAP: dict[type, str] = {
    str: "string",
    int: "number",
    float: "number",
    bool: "boolean",
    datetime: "string",
    bytes: "string",
    Any: "unknown",
}


def _py_type_to_ts(annotation: Any, depth: int = 0) -> str:  # noqa: C901
    """Convert a Python type annotation to a TypeScript type string."""
    if annotation is NoneType or annotation is None:
        return "null"

    if annotation in _SCALAR_MAP:
        return _SCALAR_MAP[annotation]

    origin = get_origin(annotation)
    args = get_args(annotation)

    # Optional[X] → X | null
    if origin is Union or isinstance(annotation, UnionType):
        parts = [_py_type_to_ts(a, depth + 1) for a in args if a is not NoneType]
        nullable = any(a is NoneType for a in args)
        ts = " | ".join(parts)
        if nullable:
            ts += " | null"
        return ts

    # Literal["a", "b"] → "a" | "b"
    if origin is Literal:
        return " | ".join(f'"{a}"' for a in args)

    # list[X] → X[]
    if origin is list:
        inner = _py_type_to_ts(args[0], depth + 1) if args else "unknown"
        return f"({inner})[]" if "|" in inner else f"{inner}[]"

    # dict[K, V] → Record<K, V>
    if origin is dict:
        k = _py_type_to_ts(args[0], depth + 1) if args else "string"
        v = _py_type_to_ts(args[1], depth + 1) if len(args) > 1 else "unknown"
        return f"Record<{k}, {v}>"

    # tuple[X, Y, Z] → [X, Y, Z]
    if origin is tuple:
        if args:
            return f"[{', '.join(_py_type_to_ts(a, depth + 1) for a in args)}]"
        return "unknown[]"

    # Pydantic model reference
    if hasattr(annotation, "model_fields"):
        return annotation.__name__

    # Enum → union of literals
    if inspect.isclass(annotation) and issubclass(annotation, Enum):
        return " | ".join(f'"{m.value}"' for m in annotation)

    return "unknown"


def _model_to_ts(model_cls: type) -> str:
    """Convert a single Pydantic model to a TS interface."""
    lines = [f"export interface {model_cls.__name__} {{"]
    for name, field in model_cls.model_fields.items():
        ts_type = _py_type_to_ts(field.annotation)
        optional = "?" if not field.is_required() else ""
        lines.append(f"  {name}{optional}: {ts_type};")
    lines.append("}")
    return "\n".join(lines)


def _enum_to_ts(enum_cls: type) -> str:
    """Convert a Python str enum to a TS union type."""
    members = " | ".join(f'"{m.value}"' for m in enum_cls)
    return f"export type {enum_cls.__name__} = {members};"


# -- Discover models ----------------------------------------------------------


def _collect_exports(module_path: str) -> tuple[list[type], list[type]]:
    """Import module and return (pydantic_models, enums)."""
    mod = importlib.import_module(module_path)
    models, enums = [], []
    for _name, obj in inspect.getmembers(mod, inspect.isclass):
        if obj.__module__ != mod.__name__:
            continue
        if hasattr(obj, "model_fields"):
            models.append(obj)
        elif issubclass(obj, Enum):
            enums.append(obj)
    return models, enums


def main() -> None:
    sources = [
        "perception.models",
        "openeye_ai.schema",
    ]

    all_enums: list[type] = []
    all_models: list[type] = []

    for src in sources:
        try:
            models, enums = _collect_exports(src)
            all_enums.extend(enums)
            all_models.extend(models)
        except Exception as exc:
            print(f"Warning: could not import {src}: {exc}")

    # Deduplicate by name (prefer first occurrence)
    seen: set[str] = set()
    unique_enums = []
    for e in all_enums:
        if e.__name__ not in seen:
            seen.add(e.__name__)
            unique_enums.append(e)
    unique_models = []
    for m in all_models:
        if m.__name__ not in seen:
            seen.add(m.__name__)
            unique_models.append(m)

    parts = [
        "/**",
        " * AUTO-GENERATED from Pydantic models — do not edit manually.",
        f" * Run: python scripts/sync-types.py",
        " */",
        "",
    ]

    for e in unique_enums:
        parts.append(_enum_to_ts(e))
        parts.append("")

    for m in unique_models:
        parts.append(_model_to_ts(m))
        parts.append("")

    OUTPUT.write_text("\n".join(parts))
    print(f"Wrote {len(unique_enums)} enums + {len(unique_models)} models → {OUTPUT}")


if __name__ == "__main__":
    main()
