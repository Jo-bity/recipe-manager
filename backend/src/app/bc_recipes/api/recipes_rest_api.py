from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.bc_recipes.domain.recipe import Recipe, RecipeAction, RecipeDocument
from app.bc_recipes.service.exceptions import (
    ActionNotFound,
    InvalidRecipe,
    OrderConflict,
    RecipeNotFound,
    UnsupportedVendor,
)
from app.bc_recipes.service.recipes_service import RecipesService
from app.dependencies import get_recipes_service

router = APIRouter(prefix="/recipes")

ERROR_RESPONSES = {
    404: {
        "description": "Recipe or Action was not found.",
        "content": {
            "application/json": {
                "example": {"detail": {"code": "not_found", "message": "Recipe was not found."}}
            }
        },
    },
    409: {
        "description": "The requested Action ordering change conflicts with the current Recipe state.",
        "content": {
            "application/json": {
                "example": {
                    "detail": {
                        "code": "order_conflict",
                        "message": "The requested action position is outside the recipe.",
                    }
                }
            }
        },
    },
    422: {
        "description": "Recipe or Action payload is structurally valid JSON but violates domain rules.",
        "content": {
            "application/json": {
                "example": {
                    "detail": {
                        "code": "invalid_recipe",
                        "message": "Recipe must contain at least one action.",
                        "errors": [
                            {
                                "path": "actions",
                                "message": "Add at least one action before export or preview.",
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


class MoveActionRequest(BaseModel):
    position: int = Field(
        ge=0,
        description="Zero-based target position for the Action within the Recipe sequence.",
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
    description="Create an empty Recipe. Actions are added through nested Action endpoints.",
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
    description="Return one Recipe with its ordered Action List.",
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
    description="Update the technician-facing Recipe name without changing its Actions.",
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
    description="Delete a Recipe and its Action List.",
    operation_id="deleteRecipe",
    responses={204: {"description": "Recipe deleted."}, 404: ERROR_RESPONSES[404]},
)
async def delete_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> None:
    _call(lambda: service.delete_recipe(recipe_id))


@router.post(
    "/{recipe_id}/actions",
    status_code=status.HTTP_201_CREATED,
    tags=["recipes"],
    summary="Add Action",
    description=(
        "Append a Take Image or Unscrewing Action to a Recipe. The Action envelope "
        "contains `id`, `type`, and type-specific `parameters`; the backend assigns "
        "a fresh Action ID and validates the parameters fail-fast."
    ),
    operation_id="addRecipeAction",
    responses={201: {"description": "Action added; full Recipe returned."}, 404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def add_action(
    recipe_id: UUID,
    action: RecipeAction = Body(
        ...,
        description="Action payload. Use `type` to choose `take_image` or `unscrewing`; put type-specific fields under `parameters`.",
    ),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.add_action(recipe_id, action))


@router.patch(
    "/{recipe_id}/actions/{action_id}",
    tags=["recipes"],
    summary="Replace Action",
    description="Replace an existing Action while preserving its Action ID and position in the Action List.",
    operation_id="replaceRecipeAction",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def update_action(
    recipe_id: UUID,
    action_id: UUID,
    action: RecipeAction = Body(
        ...,
        description="Replacement Action payload. The path Action ID remains authoritative.",
    ),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.update_action(recipe_id, action_id, action))


@router.delete(
    "/{recipe_id}/actions/{action_id}",
    tags=["recipes"],
    summary="Remove Action",
    description="Remove one Action from a Recipe and return the updated Recipe.",
    operation_id="removeRecipeAction",
    responses={404: ERROR_RESPONSES[404]},
)
async def delete_action(
    recipe_id: UUID,
    action_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.delete_action(recipe_id, action_id))


@router.post(
    "/{recipe_id}/actions/{action_id}/move",
    tags=["recipes"],
    summary="Move Action",
    description="Move an Action to a zero-based position. The backend owns ordering invariants for the Action List.",
    operation_id="moveRecipeAction",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[409]},
)
async def move_action(
    recipe_id: UUID,
    action_id: UUID,
    request: MoveActionRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.move_action(recipe_id, action_id, request.position))


@router.post(
    "/{recipe_id}/validate",
    tags=["recipe validation"],
    summary="Validate Recipe",
    description="Validate that a Recipe contains a well-formed Action List ready for export or robot command preview.",
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
        "The exported Recipe uses the shared Action Model: ordered `actions`, each with "
        "`id`, `type`, and `parameters`."
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
    description="Create a new editable Recipe from canonical Recipe JSON using the Action Model.",
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
        "Translate a valid Recipe Action List into a vendor-specific command plan without executing it. "
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
    except ActionNotFound as exc:
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
