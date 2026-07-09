from datetime import datetime
from uuid import UUID, uuid4

from app.bc_recipes.domain.recipe import Recipe, RecipeDocument, RecipeStep
from app.bc_recipes.service.exceptions import (
    FieldError,
    InvalidRecipe,
    OrderConflict,
    RecipeNotFound,
    StepNotFound,
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
            steps=document.steps,
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

    def add_step(self, recipe_id: UUID, step: RecipeStep) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        step = step.model_copy(update={"id": uuid4()})
        updated = recipe.model_copy(
            update={"steps": [*recipe.steps, step], "updated_at": datetime.now()}
        )
        return self.recipes_repository.save_recipe(updated)

    def update_step(self, recipe_id: UUID, step_id: UUID, step: RecipeStep) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        steps = []
        found = False
        for existing in recipe.steps:
            if existing.id == step_id:
                steps.append(step.model_copy(update={"id": step_id}))
                found = True
            else:
                steps.append(existing)
        if not found:
            raise StepNotFound(f"Step {step_id} was not found.")
        updated = recipe.model_copy(update={"steps": steps, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def delete_step(self, recipe_id: UUID, step_id: UUID) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        steps = [step for step in recipe.steps if step.id != step_id]
        if len(steps) == len(recipe.steps):
            raise StepNotFound(f"Step {step_id} was not found.")
        updated = recipe.model_copy(update={"steps": steps, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def move_step(self, recipe_id: UUID, step_id: UUID, position: int) -> Recipe:
        recipe = self.get_recipe(recipe_id)
        if position < 0 or position >= len(recipe.steps):
            raise OrderConflict("The requested step position is outside the recipe.")

        steps = list(recipe.steps)
        source_index = next((index for index, step in enumerate(steps) if step.id == step_id), None)
        if source_index is None:
            raise StepNotFound(f"Step {step_id} was not found.")

        step = steps.pop(source_index)
        steps.insert(position, step)
        updated = recipe.model_copy(update={"steps": steps, "updated_at": datetime.now()})
        return self.recipes_repository.save_recipe(updated)

    def export_recipe(self, recipe_id: UUID) -> RecipeDocument:
        recipe = self.get_recipe(recipe_id)
        self._ensure_has_steps(recipe)
        return RecipeDocument(name=recipe.name, steps=recipe.steps)

    def preview_robot_commands(self, recipe_id: UUID, vendor: str) -> dict:
        recipe = self.get_recipe(recipe_id)
        self._ensure_has_steps(recipe)
        normalized_vendor = vendor.lower()
        if normalized_vendor not in {"company_a", "company_b"}:
            raise UnsupportedVendor(f"Vendor {vendor} is not supported.")

        return {
            "vendor": normalized_vendor,
            "recipe_id": recipe.id,
            "commands": [
                self._to_vendor_command(normalized_vendor, index, step)
                for index, step in enumerate(recipe.steps, start=1)
            ],
        }

    def _ensure_has_steps(self, recipe: Recipe) -> None:
        if not recipe.steps:
            raise InvalidRecipe(
                "Recipe must contain at least one step.",
                [FieldError(path="steps", message="Add at least one step before export or preview.")],
            )

    def _to_vendor_command(self, vendor: str, sequence: int, step: RecipeStep) -> dict:
        if step.type == "take_image":
            if vendor == "company_a":
                return {
                    "sequence": sequence,
                    "operation": "capture_image",
                    "pointcloud": step.include_pointcloud,
                    "scope": step.image_scope,
                    "center": step.center,
                }
            return {
                "sequence": sequence,
                "command": "PHOTO_CAPTURE",
                "include_depth_map": step.include_pointcloud,
                "region": step.image_scope,
                "center_coordinates": step.center,
            }

        if vendor == "company_a":
            return {
                "sequence": sequence,
                "operation": "unscrew",
                "strategy": step.mode,
                "target": step.target,
            }
        return {
            "sequence": sequence,
            "command": "REMOVE_SCREW",
            "mode": step.mode,
            "target_coordinates": step.target,
        }
