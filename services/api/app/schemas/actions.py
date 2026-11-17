"""Map actions the agent can take. Each one becomes a model tool declaration.

Every action is `{name, args}`, matching the shape of a model function call, so the
browser can validate a tool call against the exported JSON Schema without reshaping it.
"""

from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import Id, StrictModel
from app.schemas.profile import Need, TravellerProfileId


class NoArgs(StrictModel):
    pass


class SetTravellerProfileArgs(StrictModel):
    profile: TravellerProfileId
    needs: list[Need] = Field(default_factory=list, max_length=10)


class SelectHotelArgs(StrictModel):
    hotel_id: Id


class StopArgs(StrictModel):
    stop_id: Id


class SetTravellerProfile(StrictModel):
    """Record who is travelling and what they need."""

    name: Literal["set_traveller_profile"]
    args: SetTravellerProfileArgs


class SelectHotel(StrictModel):
    """Highlight the hotel and frame it in 3D."""

    name: Literal["select_hotel"]
    args: SelectHotelArgs


class ShowRoute(StrictModel):
    """Draw the walking route as a 3D line."""

    name: Literal["show_route"]
    args: NoArgs = Field(default_factory=NoArgs)


class StartWalk(StrictModel):
    """Begin the camera fly-along from the hotel."""

    name: Literal["start_walk"]
    args: NoArgs = Field(default_factory=NoArgs)


class FlyToStop(StrictModel):
    """Move the camera to a stop."""

    name: Literal["fly_to_stop"]
    args: StopArgs


class EnterStreetView(StrictModel):
    """Open Street View at a stop, facing the walking direction."""

    name: Literal["enter_street_view"]
    args: StopArgs


class ExitStreetView(StrictModel):
    """Return from Street View to the 3D map."""

    name: Literal["exit_street_view"]
    args: NoArgs = Field(default_factory=NoArgs)


class PauseWalk(StrictModel):
    """Pause the fly-along."""

    name: Literal["pause_walk"]
    args: NoArgs = Field(default_factory=NoArgs)


class ResumeWalk(StrictModel):
    """Resume the fly-along."""

    name: Literal["resume_walk"]
    args: NoArgs = Field(default_factory=NoArgs)


MapAction = Annotated[
    SetTravellerProfile
    | SelectHotel
    | ShowRoute
    | StartWalk
    | FlyToStop
    | EnterStreetView
    | ExitStreetView
    | PauseWalk
    | ResumeWalk,
    Field(discriminator="name"),
]
