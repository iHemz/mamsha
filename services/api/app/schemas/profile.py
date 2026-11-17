"""Traveller profiles the agent tailors its narration to."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.common import StrictModel

TravellerProfileId = Literal["wheelchair_family", "young_couple"]

Need = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class TravellerProfile(StrictModel):
    id: TravellerProfileId
    needs: list[Need] = Field(default_factory=list, max_length=10)
