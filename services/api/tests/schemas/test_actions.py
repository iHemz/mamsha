from typing import Any, get_args

import pytest
from pydantic import TypeAdapter, ValidationError

from app.schemas import MapAction
from app.schemas.actions import NoArgs

adapter: TypeAdapter[MapAction] = TypeAdapter(MapAction)

VALID_ACTIONS: list[dict[str, Any]] = [
    {"name": "set_traveller_profile", "args": {"profile": "wheelchair_family", "needs": ["ramp"]}},
    {"name": "select_hotel", "args": {"hotel_id": "test-hotel"}},
    {"name": "show_route", "args": {}},
    {"name": "start_walk", "args": {}},
    {"name": "fly_to_stop", "args": {"stop_id": "stop-1"}},
    {"name": "enter_street_view", "args": {"stop_id": "stop-1"}},
    {"name": "exit_street_view", "args": {}},
    {"name": "pause_walk", "args": {}},
    {"name": "resume_walk", "args": {}},
]


def test_every_action_variant_has_a_valid_example() -> None:
    variants = get_args(get_args(MapAction)[0])
    declared = {v.model_fields["name"].annotation.__args__[0] for v in variants}
    assert declared == {a["name"] for a in VALID_ACTIONS}


@pytest.mark.parametrize("action", VALID_ACTIONS, ids=lambda a: a["name"])
def test_valid_actions_parse(action: dict[str, Any]) -> None:
    parsed = adapter.validate_python(action)
    assert parsed.name == action["name"]


def test_no_arg_actions_default_their_args() -> None:
    parsed = adapter.validate_python({"name": "start_walk"})
    assert parsed.args == NoArgs()


def test_unknown_action_is_rejected() -> None:
    with pytest.raises(ValidationError):
        adapter.validate_python({"name": "teleport", "args": {}})


@pytest.mark.parametrize(
    "action",
    [
        {"name": "select_hotel", "args": {}},
        {"name": "fly_to_stop", "args": {"stop_id": "Stop One"}},
        {"name": "fly_to_stop", "args": {"stop_id": "stop-1", "speed": 2}},
        {"name": "set_traveller_profile", "args": {"profile": "solo"}},
        {"name": "start_walk", "args": {"now": True}},
    ],
)
def test_invalid_args_are_rejected(action: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        adapter.validate_python(action)
