from datetime import datetime
from uuid import UUID, uuid4

from app.bc_recipes.domain.recipe import Recipe, RecipeAction, RecipeDocument
from app.bc_recipes.service.exceptions import (
    ActionNotFound,
    FieldError,
    InvalidRecipe,
    OrderConflict,
    RecipeNotFound,
    UnsupportedVendor,
)
from app.bc_recipes.service.ports import RecipesRepository


class RecipesService:
    def __init__(self, recipes_repository: RecipesRepository):
        self.recipes_repository = recipes_repository

    def list_recipes(self) -> list[Recipe]:
        return self.recipes_repository.list_recipes()

    def create_recipe(self, document: RecipeDocument) -> Recipe:
        now = datetime.now()
        recipe = Recipe(
            id=uuid4(),
            schema_version=document.schema_version,
            name=document.name,
            actions=document.actions,
            created_at=now,
            updated_at=now,
        )
        return self.recipes_repository.save_recipe(recipe)

    def import_recipe(self, document: RecipeDocument) -> Recipe:
        return self.create_recipe(document)

    def get_recipe(self, recipe_id: UUID) -> Recipe:
        recipe = self.recipes_repository.get_recipe(recipe_id)
        if recipe is None:
            raise RecipeNotFound(f"Recipe {recipe_id} was not found.")
        return recipe

    def update_recipe_name(self, recipe_id: UUID, name: str) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        updated = recipe.model_copy(update={"name": name, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def delete_recipe(self, recipe_id: UUID) -> None:
        if not self.recipes_repository.delete_recipe(recipe_id):
            raise RecipeNotFound(f"Recipe {recipe_id} was not found.")

    def add_action(self, recipe_id: UUID, action: RecipeAction) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        action = action.model_copy(update={"id": uuid4()})
        updated = recipe.model_copy(
            update={"actions": [*recipe.actions, action], "updated_at": datetime.now()}
        )
        return self.recipes_repository.save_recipe(updated)

    def update_action(self, recipe_id: UUID, action_id: UUID, action: RecipeAction) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        actions = []
        found = False
        for existing in recipe.actions:
            if existing.id == action_id:
                actions.append(action.model_copy(update={"id": action_id}))
                found = True
            else:
                actions.append(existing)
        if not found:
            raise ActionNotFound(f"Action {action_id} was not found.")
        updated = recipe.model_copy(update={"actions": actions, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def delete_action(self, recipe_id: UUID, action_id: UUID) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        actions = [action for action in recipe.actions if action.id != action_id]
        if len(actions) == len(recipe.actions):
            raise ActionNotFound(f"Action {action_id} was not found.")
        updated = recipe.model_copy(update={"actions": actions, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def move_action(self, recipe_id: UUID, action_id: UUID, position: int) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        if position < 0 or position >= len(recipe.actions):
            raise OrderConflict("The requested action position is outside the recipe.")

        actions = list(recipe.actions)
        source_index = next((index for index, action in enumerate(actions) if action.id == action_id), None)
        if source_index is None:
            raise ActionNotFound(f"Action {action_id} was not found.")

        action = actions.pop(source_index)
        actions.insert(position, action)
        updated = recipe.model_copy(update={"actions": actions, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def export_recipe(self, recipe_id: UUID) -> RecipeDocument:
        recipe = self.get_recipe(recipe_id)
        self._ensure_has_actions(recipe)
        return RecipeDocument(name=recipe.name, actions=recipe.actions)

    def preview_robot_commands(self, recipe_id: UUID, vendor: str) -> dict:
        recipe = self.get_recipe(recipe_id)
        self._ensure_has_actions(recipe)
        normalized_vendor = vendor.lower()
        if normalized_vendor not in {"company_a", "company_b"}:
            raise UnsupportedVendor(f"Vendor {vendor} is not supported.")

        return {
            "vendor": normalized_vendor,
            "recipe_id": recipe.id,
            "commands": [
                self._to_vendor_command(normalized_vendor, index, action)
                for index, action in enumerate(recipe.actions, start=1)
            ],
        }

    def _ensure_has_actions(self, recipe: Recipe) -> None:
        if not recipe.actions:
            raise InvalidRecipe(
                "Recipe must contain at least one action.",
                [FieldError(path="actions", message="Add at least one action before export or preview.")],
            )

    def _to_vendor_command(self, vendor: str, sequence: int, action: RecipeAction) -> dict:
        parameters = action.parameters
        if action.type == "take_image":
            if vendor == "company_a":
                return {
                    "sequence": sequence,
                    "operation": "capture_image",
                    "pointcloud": parameters.include_pointcloud,
                    "scope": parameters.image_scope,
                    "center": parameters.center,
                }
            return {
                "sequence": sequence,
                "command": "PHOTO_CAPTURE",
                "include_depth_map": parameters.include_pointcloud,
                "region": parameters.image_scope,
                "center_coordinates": parameters.center,
            }

        if vendor == "company_a":
            return {
                "sequence": sequence,
                "operation": "unscrew",
                "strategy": parameters.mode,
                "target": parameters.target,
            }
        return {
            "sequence": sequence,
            "command": "REMOVE_SCREW",
            "mode": parameters.mode,
            "target_coordinates": parameters.target,
        }
