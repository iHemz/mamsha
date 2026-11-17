"""Route data: the only source of place facts the agent may state."""

from collections import Counter
from typing import Annotated, Self

from pydantic import Field, StringConstraints, model_validator

from app.schemas.common import Id, LatLng, NonEmptyText, StrictModel
from app.schemas.profile import TravellerProfileId

VerifiedFrom = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3)]


class Fact(StrictModel):
    """A single place fact. It must say where it was verified, so nothing is invented."""

    id: Id
    text: NonEmptyText
    profiles: list[TravellerProfileId] = Field(
        min_length=1, description="Traveller profiles this fact is relevant to."
    )
    verified_from: VerifiedFrom = Field(
        description="Where Williams confirmed this fact (e.g. 'Street View, Nov 2026')."
    )


class Place(StrictModel):
    id: Id
    name: NonEmptyText
    position: LatLng
    facts: list[Fact] = Field(default_factory=list)


class Stop(StrictModel):
    id: Id
    title: NonEmptyText
    position: LatLng
    heading: float = Field(ge=0, lt=360, description="Walking direction at this stop, degrees.")
    facts: list[Fact] = Field(min_length=1)


class RouteData(StrictModel):
    hotel: Place
    gate: Place
    path: list[LatLng] = Field(min_length=2, description="Walking line from hotel to gate.")
    stops: list[Stop] = Field(min_length=1)

    @model_validator(mode="after")
    def _ids_are_unique(self) -> Self:
        _require_unique([self.hotel.id, self.gate.id, *(s.id for s in self.stops)], "place")
        facts = [*self.hotel.facts, *self.gate.facts, *(f for s in self.stops for f in s.facts)]
        _require_unique([f.id for f in facts], "fact")
        return self


def _require_unique(ids: list[str], kind: str) -> None:
    dupes = sorted(i for i, n in Counter(ids).items() if n > 1)
    if dupes:
        msg = f"duplicate {kind} ids: {', '.join(dupes)}"
        raise ValueError(msg)
