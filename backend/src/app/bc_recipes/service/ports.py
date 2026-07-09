from typing import Protocol
from uuid import UUID

from app.bc_recipes.domain.recipe import Recipe


class RecipesRepository(Protocol):
    def list_recipes(self) -> list[Recipe]:
        ...

    def get_recipe(self, recipe_id: UUID) -> Recipe | None:
        ...

    def save_recipe(self, recipe: Recipe) -> Recipe:
        ...

    def delete_recipe(self, recipe_id: UUID) -> bool:
        ...
