"""Shared building blocks for every schema."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Id = Annotated[
    str,
    StringConstraints(pattern=r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$", min_length=1, max_length=64),
]
"""Lowercase slug used for hotels, gates, stops and facts (e.g. `stop-2`, `gate_79`)."""

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class StrictModel(BaseModel):
    """Base for all shared models: unknown fields are rejected and instances are immutable."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class LatLng(StrictModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
