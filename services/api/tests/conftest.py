import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_route_path() -> Path:
    return FIXTURES / "route.sample.json"


@pytest.fixture
def sample_route(sample_route_path: Path) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(sample_route_path.read_text(encoding="utf-8"))
    return data


@pytest.fixture
def settings(sample_route_path: Path) -> Settings:
    # Never read the developer's .env in tests.
    return Settings(_env_file=None, app_env="test", route_data_path=sample_route_path)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as test_client:
        yield test_client
