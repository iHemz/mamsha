"""Loads and validates `data/route.json`."""

from pathlib import Path

from pydantic import ValidationError

from app.schemas import RouteData


class RouteDataUnavailableError(Exception):
    """The route file is missing or does not match the `RouteData` schema."""


def load_route(path: Path) -> RouteData:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        msg = f"route data not found at {path}"
        raise RouteDataUnavailableError(msg) from exc
    try:
        return RouteData.model_validate_json(raw)
    except ValidationError as exc:
        msg = f"route data at {path} is invalid: {exc.error_count()} error(s)"
        raise RouteDataUnavailableError(msg) from exc
