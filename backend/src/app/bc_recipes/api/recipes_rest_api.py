from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.bc_recipes.domain.recipe import Recipe, RecipeDocument, RecipeStep
from app.bc_recipes.service.exceptions import (
    InvalidRecipe,
    OrderConflict,
    RecipeNotFound,
    StepNotFound,
    UnsupportedVendor,
)
from app.bc_recipes.service.recipes_service import RecipesService
from app.dependencies import get_recipes_service

router = APIRouter(prefix="/recipes")

ERROR_RESPONSES = {
    404: {
        "description": "Recipe or Step was not found.",
        "content": {
            "application/json": {
                "example": {"detail": {"code": "not_found", "message": "Recipe was not found."}}
            }
        },
    },
    409: {
        "description": "The requested Step ordering change conflicts with the current Recipe state.",
        "content": {
            "application/json": {
                "example": {
                    "detail": {
                        "code": "order_conflict",
                        "message": "The requested step position is outside the recipe.",
                    }
                }
            }
        },
    },
    422: {
        "description": "Recipe or Step payload is structurally valid JSON but violates domain rules.",
        "content": {
            "application/json": {
                "example": {
                    "detail": {
                        "code": "invalid_recipe",
                        "message": "Recipe must contain at least one step.",
                        "errors": [
                            {
                                "path": "steps",
                                "message": "Add at least one step before export or preview.",
                            }
                        ],
                    }
                }
            }
        },
    },
}


class RecipeCreateRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=120,
        description="Technician-facing name for the new Recipe.",
        examples=["Battery pack screw removal"],
    )


class RecipeUpdateRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=120,
        description="Updated technician-facing Recipe name.",
        examples=["Battery pack screw removal v2"],
    )


class MoveStepRequest(BaseModel):
    position: int = Field(
        ge=0,
        description="Zero-based target position for the Step within the Recipe sequence.",
        examples=[0],
    )


class ValidationResponse(BaseModel):
    valid: bool = Field(description="True when the Recipe is valid for export or command preview.")


@router.get(
    "",
    tags=["recipes"],
    summary="List Recipes",
    description="Return all persisted Recipes ordered by most recently updated first.",
    operation_id="listRecipes",
)
async def list_recipes(service: RecipesService = Depends(get_recipes_service)) -> list[Recipe]:
    return service.list_recipes()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    tags=["recipes"],
    summary="Create Recipe",
    description="Create an empty Recipe. Steps are added through nested Step endpoints.",
    operation_id="createRecipe",
    responses={201: {"description": "Recipe created."}},
)
async def create_recipe(
    request: RecipeCreateRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return service.create_recipe(RecipeDocument(name=request.name))


@router.get(
    "/{recipe_id}",
    tags=["recipes"],
    summary="Get Recipe",
    description="Return one Recipe with its ordered Step List.",
    operation_id="getRecipe",
    responses={404: ERROR_RESPONSES[404]},
)
async def get_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.get_recipe(recipe_id))


@router.patch(
    "/{recipe_id}",
    tags=["recipes"],
    summary="Rename Recipe",
    description="Update the technician-facing Recipe name without changing its Steps.",
    operation_id="renameRecipe",
    responses={404: ERROR_RESPONSES[404]},
)
async def update_recipe(
    recipe_id: UUID,
    request: RecipeUpdateRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.update_recipe_name(recipe_id, request.name))


@router.delete(
    "/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["recipes"],
    summary="Delete Recipe",
    description="Delete a Recipe and its Step List.",
    operation_id="deleteRecipe",
    responses={204: {"description": "Recipe deleted."}, 404: ERROR_RESPONSES[404]},
)
async def delete_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> None:
    _call(lambda: service.delete_recipe(recipe_id))


@router.post(
    "/{recipe_id}/steps",
    status_code=status.HTTP_201_CREATED,
    tags=["recipes"],
    summary="Add Step",
    description=(
        "Append a Step to a Recipe. Each Step has a case-study `type` and exactly one "
        "matching atomic Action in the MVP."
    ),
    operation_id="addRecipeStep",
    responses={201: {"description": "Step added; full Recipe returned."}, 404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def add_step(
    recipe_id: UUID,
    step: RecipeStep = Body(
        ...,
        description="Step payload. Set `type` to `take_image` or `unscrewing` and put the matching atomic Action under `actions`.",
    ),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.add_step(recipe_id, step))


@router.patch(
    "/{recipe_id}/steps/{step_id}",
    tags=["recipes"],
    summary="Replace Step",
    description="Replace an existing Step while preserving its Step ID and position in the Step List.",
    operation_id="replaceRecipeStep",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def update_step(
    recipe_id: UUID,
    step_id: UUID,
    step: RecipeStep = Body(
        ...,
        description="Replacement Step payload. The path Step ID remains authoritative.",
    ),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.update_step(recipe_id, step_id, step))


@router.delete(
    "/{recipe_id}/steps/{step_id}",
    tags=["recipes"],
    summary="Remove Step",
    description="Remove one Step from a Recipe and return the updated Recipe.",
    operation_id="removeRecipeStep",
    responses={404: ERROR_RESPONSES[404]},
)
async def delete_step(
    recipe_id: UUID,
    step_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.delete_step(recipe_id, step_id))


@router.post(
    "/{recipe_id}/steps/{step_id}/move",
    tags=["recipes"],
    summary="Move Step",
    description="Move a Step to a zero-based position. The backend owns ordering invariants for the Step List.",
    operation_id="moveRecipeStep",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[409]},
)
async def move_step(
    recipe_id: UUID,
    step_id: UUID,
    request: MoveStepRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.move_step(recipe_id, step_id, request.position))


@router.post(
    "/{recipe_id}/validate",
    tags=["recipe validation"],
    summary="Validate Recipe",
    description="Validate that a Recipe contains a well-formed Step List ready for export or robot command preview.",
    operation_id="validateRecipe",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def validate_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> ValidationResponse:
    _call(lambda: service.export_recipe(recipe_id))
    return ValidationResponse(valid=True)


@router.get(
    "/{recipe_id}/export",
    tags=["recipe exchange"],
    summary="Export Recipe JSON",
    description=(
        "Return canonical vendor-neutral Recipe JSON for review, storage, or later import. "
        "The exported Recipe uses ordered `steps`, each with a case-study `type` and "
        "one matching atomic Action with `id`, `type`, and `parameters`."
    ),
    operation_id="exportRecipeJson",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def export_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> RecipeDocument:
    return _call(lambda: service.export_recipe(recipe_id))


@router.post(
    "/import",
    status_code=status.HTTP_201_CREATED,
    tags=["recipe exchange"],
    summary="Import Recipe JSON",
    description="Create a new editable Recipe from canonical Recipe JSON using the Step/Action model.",
    operation_id="importRecipeJson",
    responses={201: {"description": "Recipe imported."}, 422: ERROR_RESPONSES[422]},
)
async def import_recipe(
    document: RecipeDocument,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return service.import_recipe(document)


@router.post(
    "/{recipe_id}/robot-commands/preview",
    tags=["robot adapters"],
    summary="Preview Robot Commands",
    description=(
        "Translate a valid Recipe Step List into a vendor-specific command plan without executing it. "
        "Supported vendors are `company_a` and `company_b`."
    ),
    operation_id="previewRobotCommands",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def preview_robot_commands(
    recipe_id: UUID,
    vendor: str = Query(
        ...,
        description="Robot vendor adapter to use for command preview.",
        examples=["company_a"],
    ),
    service: RecipesService = Depends(get_recipes_service),
) -> dict:
    return _call(lambda: service.preview_robot_commands(recipe_id, vendor))


def _call(operation):
    try:
        return operation()
    except RecipeNotFound as exc:
        raise _api_error(status.HTTP_404_NOT_FOUND, "not_found", str(exc)) from exc
    except StepNotFound as exc:
        raise _api_error(status.HTTP_404_NOT_FOUND, "not_found", str(exc)) from exc
    except OrderConflict as exc:
        raise _api_error(status.HTTP_409_CONFLICT, "order_conflict", str(exc)) from exc
    except UnsupportedVendor as exc:
        raise _api_error(422, "unsupported_vendor", str(exc)) from exc
    except InvalidRecipe as exc:
        raise _api_error(
            422,
            "invalid_recipe",
            exc.message,
            [{"path": error.path, "message": error.message} for error in exc.errors],
        ) from exc


def _api_error(
    status_code: int,
    code: str,
    message: str,
    errors: list[dict[str, Any]] | None = None,
) -> HTTPException:
    detail: dict[str, Any] = {"code": code, "message": message}
    if errors is not None:
        detail["errors"] = errors
    return HTTPException(status_code=status_code, detail=detail)
