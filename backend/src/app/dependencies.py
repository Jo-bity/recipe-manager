import os

from app.bc_recipes.repository.recipes_repository import SqliteRecipesRepository
from app.bc_recipes.service.recipes_service import RecipesService

recipes_repository = SqliteRecipesRepository(os.getenv("RECIPE_DB_PATH", "recipes.db"))
recipes_service = RecipesService(recipes_repository)


def get_recipes_service() -> RecipesService:
    return recipes_service
