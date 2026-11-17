"""Validates the real `data/route.json` that the demo ships with."""

import pytest

from app.config import REPO_ROOT
from app.route_store import load_route

ROUTE_FILE = REPO_ROOT / "data" / "route.json"

pytestmark = pytest.mark.skipif(
    not ROUTE_FILE.exists(),
    reason="data/route.json not written yet (waiting on Williams's hotel and route choice)",
)


def test_route_json_matches_the_schema() -> None:
    load_route(ROUTE_FILE)


def test_route_json_has_four_or_five_stops() -> None:
    assert 4 <= len(load_route(ROUTE_FILE).stops) <= 5


def test_every_profile_gets_narration_at_every_stop() -> None:
    route = load_route(ROUTE_FILE)
    for stop in route.stops:
        covered = {p for fact in stop.facts for p in fact.profiles}
        assert covered == {"wheelchair_family", "young_couple"}, stop.id
