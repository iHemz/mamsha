import copy
from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas import RouteData


def test_sample_route_is_valid(sample_route: dict[str, Any]) -> None:
    route = RouteData.model_validate(sample_route)
    assert route.hotel.id == "test-hotel"
    assert [s.id for s in route.stops] == ["stop-1", "stop-2"]


def _first_fact(route: dict[str, Any]) -> dict[str, Any]:
    fact: dict[str, Any] = route["stops"][0]["facts"][0]
    return fact


@pytest.mark.parametrize("value", [None, "", "  ", "ab"])
def test_fact_needs_a_real_verified_from(sample_route: dict[str, Any], value: str | None) -> None:
    route = copy.deepcopy(sample_route)
    if value is None:
        del _first_fact(route)["verified_from"]
    else:
        _first_fact(route)["verified_from"] = value
    with pytest.raises(ValidationError, match="verified_from"):
        RouteData.model_validate(route)


def test_fact_needs_at_least_one_profile(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    _first_fact(route)["profiles"] = []
    with pytest.raises(ValidationError, match="profiles"):
        RouteData.model_validate(route)


def test_fact_rejects_unknown_profile(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    _first_fact(route)["profiles"] = ["solo_traveller"]
    with pytest.raises(ValidationError, match="profiles"):
        RouteData.model_validate(route)


def test_stop_needs_at_least_one_fact(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][0]["facts"] = []
    with pytest.raises(ValidationError, match="facts"):
        RouteData.model_validate(route)


@pytest.mark.parametrize("heading", [-1, 360, 400])
def test_heading_must_be_in_0_to_360(sample_route: dict[str, Any], heading: float) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][0]["heading"] = heading
    with pytest.raises(ValidationError, match="heading"):
        RouteData.model_validate(route)


@pytest.mark.parametrize(("field", "value"), [("lat", 91), ("lat", -91), ("lng", 181)])
def test_coordinates_must_be_on_earth(
    sample_route: dict[str, Any], field: str, value: float
) -> None:
    route = copy.deepcopy(sample_route)
    route["hotel"]["position"][field] = value
    with pytest.raises(ValidationError, match=field):
        RouteData.model_validate(route)


def test_path_needs_two_points(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["path"] = route["path"][:1]
    with pytest.raises(ValidationError, match="path"):
        RouteData.model_validate(route)


def test_duplicate_stop_ids_are_rejected(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][1]["id"] = "stop-1"
    with pytest.raises(ValidationError, match="duplicate place ids: stop-1"):
        RouteData.model_validate(route)


def test_stop_id_cannot_reuse_hotel_id(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][0]["id"] = "test-hotel"
    with pytest.raises(ValidationError, match="duplicate place ids: test-hotel"):
        RouteData.model_validate(route)


def test_duplicate_fact_ids_are_rejected_across_places(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][1]["facts"][0]["id"] = "test-hotel-entrance"
    with pytest.raises(ValidationError, match="duplicate fact ids: test-hotel-entrance"):
        RouteData.model_validate(route)


@pytest.mark.parametrize("bad_id", ["Stop 1", "stop_", "-stop", "STOP", ""])
def test_ids_must_be_lowercase_slugs(sample_route: dict[str, Any], bad_id: str) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][0]["id"] = bad_id
    with pytest.raises(ValidationError):
        RouteData.model_validate(route)


def test_unknown_fields_are_rejected(sample_route: dict[str, Any]) -> None:
    route = copy.deepcopy(sample_route)
    route["stops"][0]["note"] = "not part of the schema"
    with pytest.raises(ValidationError, match="note"):
        RouteData.model_validate(route)
