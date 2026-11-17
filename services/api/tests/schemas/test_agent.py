import pytest
from pydantic import ValidationError

from app.schemas import (
    AgentTurnRequest,
    AgentTurnResponse,
    ArrivedAtStop,
    TravellerMessage,
    TravellerProfile,
)


def test_request_with_a_traveller_message() -> None:
    request = AgentTurnRequest.model_validate(
        {
            "input": {"type": "message", "text": "  My father uses a wheelchair  "},
            "profile": {"id": "wheelchair_family", "needs": ["step-free route"]},
            "history": [{"role": "agent", "text": "Assalamu alaikum, who is travelling?"}],
        }
    )
    assert isinstance(request.input, TravellerMessage)
    assert request.input.text == "My father uses a wheelchair"
    assert request.profile == TravellerProfile(id="wheelchair_family", needs=["step-free route"])


def test_request_with_an_arrived_at_stop_event() -> None:
    request = AgentTurnRequest.model_validate(
        {"input": {"type": "arrived_at_stop", "stop_id": "stop-2"}}
    )
    assert request.input == ArrivedAtStop(type="arrived_at_stop", stop_id="stop-2")
    assert request.profile is None
    assert request.history == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"input": {"type": "message", "text": "   "}},
        {"input": {"type": "message", "text": "x" * 2001}},
        {"input": {"type": "shout", "text": "hi"}},
        {"input": {"type": "message", "text": "hi"}, "history": [{"role": "system", "text": "x"}]},
        {
            "input": {"type": "message", "text": "hi"},
            "history": [{"role": "traveller", "text": "x"}] * 51,
        },
    ],
)
def test_invalid_requests_are_rejected(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        AgentTurnRequest.model_validate(payload)


def test_response_actions_default_to_empty() -> None:
    response = AgentTurnResponse.model_validate({"text": "Here is your hotel."})
    assert response.actions == []


def test_response_rejects_an_invalid_action() -> None:
    with pytest.raises(ValidationError):
        AgentTurnResponse.model_validate(
            {"text": "Flying now.", "actions": [{"name": "fly_to_stop", "args": {}}]}
        )
