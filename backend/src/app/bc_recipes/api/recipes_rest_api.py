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

router = APIRouter(prefix="/recipes", tags=["recipes"])


class RecipeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class RecipeUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class MoveStepRequest(BaseModel):
    position: int = Field(ge=0)


class ValidationResponse(BaseModel):
    valid: bool


@router.get("")
async def list_recipes(service: RecipesService = Depends(get_recipes_service)) -> list[Recipe]:
    return service.list_recipes()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_recipe(
    request: RecipeCreateRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return service.create_recipe(RecipeDocument(name=request.name))


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.get_recipe(recipe_id))


@router.patch("/{recipe_id}")
async def update_recipe(
    recipe_id: UUID,
    request: RecipeUpdateRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.update_recipe_name(recipe_id, request.name))


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> None:
    _call(lambda: service.delete_recipe(recipe_id))


@router.post("/{recipe_id}/steps", status_code=status.HTTP_201_CREATED)
async def add_step(
    recipe_id: UUID,
    step: RecipeStep = Body(...),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.add_step(recipe_id, step))


@router.patch("/{recipe_id}/steps/{step_id}")
async def update_step(
    recipe_id: UUID,
    step_id: UUID,
    step: RecipeStep = Body(...),
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.update_step(recipe_id, step_id, step))


@router.delete("/{recipe_id}/steps/{step_id}")
async def delete_step(
    recipe_id: UUID,
    step_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.delete_step(recipe_id, step_id))


@router.post("/{recipe_id}/steps/{step_id}/move")
async def move_step(
    recipe_id: UUID,
    step_id: UUID,
    request: MoveStepRequest,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return _call(lambda: service.move_step(recipe_id, step_id, request.position))


@router.post("/{recipe_id}/validate")
async def validate_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> ValidationResponse:
    _call(lambda: service.export_recipe(recipe_id))
    return ValidationResponse(valid=True)


@router.get("/{recipe_id}/export")
async def export_recipe(
    recipe_id: UUID,
    service: RecipesService = Depends(get_recipes_service),
) -> RecipeDocument:
    return _call(lambda: service.export_recipe(recipe_id))


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_recipe(
    document: RecipeDocument,
    service: RecipesService = Depends(get_recipes_service),
) -> Recipe:
    return service.import_recipe(document)


@router.post("/{recipe_id}/robot-commands/preview")
async def preview_robot_commands(
    recipe_id: UUID,
    vendor: str = Query(...),
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
