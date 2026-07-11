from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Coordinate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: int = Field(ge=0, description="Non-negative X coordinate in image or robot workspace units.")
    y: int = Field(ge=0, description="Non-negative Y coordinate in image or robot workspace units.")


class TakeImageParameters(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "include_pointcloud": True,
                "image_scope": "section",
                "center": {"x": 120, "y": 80},
            }
        },
    )

    include_pointcloud: bool = Field(
        default=False,
        description="Whether the robot should capture pointcloud/depth data with the image.",
    )
    image_scope: Literal["full_battery", "section"] = Field(
        description="Capture the full battery image or a section around center coordinates.",
    )
    center: Coordinate | None = Field(
        default=None,
        description="Required for section images; forbidden for full battery images.",
    )

    @model_validator(mode="after")
    def validate_center(self) -> "TakeImageParameters":
        if self.image_scope == "section" and self.center is None:
            raise ValueError("Section images require center coordinates.")
        if self.image_scope == "full_battery" and self.center is not None:
            raise ValueError("Full battery images must not include center coordinates.")
        return self


class UnscrewingParameters(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "mode": "specific",
                "target": {"x": 120, "y": 80},
            }
        },
    )

    mode: Literal["automatic", "specific"] = Field(
        description="Automatic unscrewing lets the robot choose targets; specific unscrewing requires target coordinates.",
    )
    target: Coordinate | None = Field(
        default=None,
        description="Required for specific unscrewing; forbidden for automatic unscrewing.",
    )

    @model_validator(mode="after")
    def validate_target(self) -> "UnscrewingParameters":
        if self.mode == "specific" and self.target is None:
            raise ValueError("Specific unscrewing requires target coordinates.")
        if self.mode == "automatic" and self.target is not None:
            raise ValueError("Automatic unscrewing must not include target coordinates.")
        return self


class TakeImageAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "id": "11111111-1111-1111-1111-111111111111",
                "type": "take_image",
                "parameters": {
                    "include_pointcloud": True,
                    "image_scope": "section",
                    "center": {"x": 120, "y": 80},
                },
            }
        },
    )

    id: UUID = Field(
        default_factory=uuid4,
        description="Stable Action identifier. Preserved during import/export when provided.",
    )
    type: Literal["take_image"] = Field(
        default="take_image",
        description="Action discriminator for image capture.",
    )
    parameters: TakeImageParameters = Field(
        description="Take Image Action parameters, validated independently from the Action envelope.",
    )


class UnscrewingAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "id": "22222222-2222-2222-2222-222222222222",
                "type": "unscrewing",
                "parameters": {
                    "mode": "specific",
                    "target": {"x": 120, "y": 80},
                },
            }
        },
    )

    id: UUID = Field(
        default_factory=uuid4,
        description="Stable Action identifier. Preserved during import/export when provided.",
    )
    type: Literal["unscrewing"] = Field(
        default="unscrewing",
        description="Action discriminator for screw removal.",
    )
    parameters: UnscrewingParameters = Field(
        description="Unscrewing Action parameters, validated independently from the Action envelope.",
    )


RecipeAction = Annotated[TakeImageAction | UnscrewingAction, Field(discriminator="type")]


class RecipeStep(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "actions": [
                    {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "type": "take_image",
                        "parameters": {
                            "include_pointcloud": True,
                            "image_scope": "section",
                            "center": {"x": 120, "y": 80},
                        },
                    }
                ],
            }
        },
    )

    id: UUID = Field(
        default_factory=uuid4,
        description="Stable Step identifier. Preserved during import/export when provided.",
    )
    actions: list[RecipeAction] = Field(
        min_length=1,
        description="Ordered atomic Actions that together execute this Step.",
    )


class RecipeDocument(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "schema_version": "1.0",
                "name": "Battery pack screw removal",
                "steps": [
                    {
                        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                        "actions": [
                            {
                                "id": "11111111-1111-1111-1111-111111111111",
                                "type": "take_image",
                                "parameters": {
                                    "include_pointcloud": True,
                                    "image_scope": "section",
                                    "center": {"x": 120, "y": 80},
                                },
                            }
                        ],
                    },
                    {
                        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                        "actions": [
                            {
                                "id": "22222222-2222-2222-2222-222222222222",
                                "type": "unscrewing",
                                "parameters": {
                                    "mode": "specific",
                                    "target": {"x": 120, "y": 80},
                                },
                            }
                        ],
                    },
                ],
            }
        },
    )

    schema_version: Literal["1.0"] = Field(
        default="1.0",
        description="Recipe JSON schema version. Used to evolve the portable format safely.",
    )
    name: str = Field(
        min_length=1,
        max_length=120,
        description="Technician-facing Recipe name.",
    )
    steps: list[RecipeStep] = Field(
        default_factory=list,
        description="Ordered Steps. Each Step contains one or more atomic Actions.",
    )


class Recipe(RecipeDocument):
    id: UUID = Field(default_factory=uuid4, description="Server-generated Recipe identifier.")
    created_at: datetime = Field(description="UTC timestamp for Recipe creation.")
    updated_at: datetime = Field(description="UTC timestamp for the latest Recipe change.")
