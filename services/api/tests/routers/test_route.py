from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings, get_settings


def test_returns_the_validated_route(client: TestClient, sample_route: dict[str, Any]) -> None:
    response = client.get("/route")
    assert response.status_code == 200
    body = response.json()
    assert body["hotel"]["id"] == sample_route["hotel"]["id"]
    assert [s["id"] for s in body["stops"]] == ["stop-1", "stop-2"]
    assert all(f["verified_from"] for s in body["stops"] for f in s["facts"])


def _use_route_file(client: TestClient, settings: Settings, path: Path) -> None:
    patched = settings.model_copy(update={"route_data_path": path})
    client.app.dependency_overrides[get_settings] = lambda: patched  # type: ignore[attr-defined]


def test_missing_route_file_is_503(client: TestClient, settings: Settings, tmp_path: Path) -> None:
    _use_route_file(client, settings, tmp_path / "missing.json")
    response = client.get("/route")
    assert response.status_code == 503
    assert response.json() == {"detail": "Route data is not available yet."}


def test_invalid_route_file_is_503_and_hides_the_path(
    client: TestClient, settings: Settings, tmp_path: Path
) -> None:
    bad = tmp_path / "route.json"
    bad.write_text('{"hotel": {}}', encoding="utf-8")
    _use_route_file(client, settings, bad)
    response = client.get("/route")
    assert response.status_code == 503
    assert str(tmp_path) not in response.text
