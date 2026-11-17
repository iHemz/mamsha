"""Export JSON Schemas from the Pydantic models into `schemas/`.

uv run python -m app.export_schemas           write the schemas
uv run python -m app.export_schemas --check   exit 1 if the committed schemas are out of date
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter

from app.config import REPO_ROOT
from app.schemas import (
    AgentTurnRequest,
    AgentTurnResponse,
    MapAction,
    RouteData,
    TravellerProfile,
)

EXPORTS: dict[str, tuple[str, TypeAdapter[Any]]] = {
    "route_data": ("RouteData", TypeAdapter(RouteData)),
    "traveller_profile": ("TravellerProfile", TypeAdapter(TravellerProfile)),
    "map_action": ("MapAction", TypeAdapter(MapAction)),
    "agent_turn_request": ("AgentTurnRequest", TypeAdapter(AgentTurnRequest)),
    "agent_turn_response": ("AgentTurnResponse", TypeAdapter(AgentTurnResponse)),
}

DRAFT = "https://json-schema.org/draft/2020-12/schema"


def build_schemas() -> dict[str, dict[str, Any]]:
    schemas: dict[str, dict[str, Any]] = {}
    for name, (title, adapter) in EXPORTS.items():
        schema = adapter.json_schema(mode="validation")
        schemas[name] = {"$schema": DRAFT, **schema, "title": title}
    return schemas


def render_schemas() -> dict[str, str]:
    return {
        f"{name}.json": json.dumps(schema, indent=2, sort_keys=True) + "\n"
        for name, schema in build_schemas().items()
    }


def write_schemas(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for filename, text in render_schemas().items():
        path = out_dir / filename
        path.write_text(text, encoding="utf-8", newline="\n")
        written.append(path)
    return written


def find_drift(out_dir: Path) -> list[str]:
    """Return a description of every file in `out_dir` that differs from the models."""
    expected = render_schemas()
    problems = []
    for filename, text in expected.items():
        path = out_dir / filename
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current != text:
            problems.append(f"out of date: {filename}")
    if out_dir.exists():
        extra = sorted(p.name for p in out_dir.glob("*.json") if p.name not in expected)
        problems.extend(f"unexpected: {name}" for name in extra)
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "schemas")
    parser.add_argument("--check", action="store_true", help="fail if the schemas are stale")
    args = parser.parse_args()
    if args.check:
        problems = find_drift(args.out)
        if problems:
            print("\n".join(problems), file=sys.stderr)
            print("JSON Schemas are out of date. Run `make gen` and commit.", file=sys.stderr)
            sys.exit(1)
        print("schemas/ is up to date")
        return
    for path in write_schemas(args.out):
        print(f"wrote {path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path}")


if __name__ == "__main__":
    main()
