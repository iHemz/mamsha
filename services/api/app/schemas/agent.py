"""Request and response for one text-mode agent turn (`POST /agent/turn`)."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.actions import MapAction
from app.schemas.common import Id, StrictModel
from app.schemas.profile import TravellerProfile

MessageText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class ChatMessage(StrictModel):
    role: Literal["traveller", "agent"]
    text: MessageText


class TravellerMessage(StrictModel):
    type: Literal["message"]
    text: MessageText


class ArrivedAtStop(StrictModel):
    """Sent by the web app when the walk reaches a stop, so the agent narrates it."""

    type: Literal["arrived_at_stop"]
    stop_id: Id


AgentInput = Annotated[TravellerMessage | ArrivedAtStop, Field(discriminator="type")]


class AgentTurnRequest(StrictModel):
    input: AgentInput
    profile: TravellerProfile | None = None
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)


class AgentTurnResponse(StrictModel):
    text: MessageText
    actions: list[MapAction] = Field(default_factory=list)
