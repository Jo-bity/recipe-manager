from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Coordinate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: int = Field(ge=0)
    y: int = Field(ge=0)


class TakeImageStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    type: Literal["take_image"] = "take_image"
    include_pointcloud: bool = False
    image_scope: Literal["full_battery", "section"]
    center: Coordinate | None = None

    @model_validator(mode="after")
    def validate_center(self) -> "TakeImageStep":
        if self.image_scope == "section" and self.center is None:
            raise ValueError("Section images require center coordinates.")
        if self.image_scope == "full_battery" and self.center is not None:
            raise ValueError("Full battery images must not include center coordinates.")
        return self


class UnscrewingStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    type: Literal["unscrewing"] = "unscrewing"
    mode: Literal["automatic", "specific"]
    target: Coordinate | None = None

    @model_validator(mode="after")
    def validate_target(self) -> "UnscrewingStep":
        if self.mode == "specific" and self.target is None:
            raise ValueError("Specific unscrewing requires target coordinates.")
        if self.mode == "automatic" and self.target is not None:
            raise ValueError("Automatic unscrewing must not include target coordinates.")
        return self


RecipeStep = Annotated[TakeImageStep | UnscrewingStep, Field(discriminator="type")]


class RecipeDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = "1.0"
    name: str = Field(min_length=1, max_length=120)
    steps: list[RecipeStep] = Field(default_factory=list)


class Recipe(RecipeDocument):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime
    updated_at: datetime
