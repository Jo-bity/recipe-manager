import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.bc_recipes.repository.recipes_repository import SqliteRecipesRepository
from app.bc_recipes.service.recipes_service import RecipesService
from app.dependencies import get_recipes_service
from app.main import app


class RecipesApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        service = RecipesService(
            SqliteRecipesRepository(str(Path(self.tempdir.name) / "recipes.db"))
        )
        app.dependency_overrides[get_recipes_service] = lambda: service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.tempdir.cleanup()

    def test_recipe_action_export_and_vendor_preview(self):
        recipe = self.client.post("/recipes", json={"name": "Battery screw removal"}).json()
        recipe_id = recipe["id"]

        take_image = self.client.post(
            f"/recipes/{recipe_id}/actions",
            json={
                "type": "take_image",
                "parameters": {
                    "include_pointcloud": True,
                    "image_scope": "section",
                    "center": {"x": 120, "y": 80},
                },
            },
        ).json()
        first_action_id = take_image["actions"][0]["id"]

        recipe = self.client.post(
            f"/recipes/{recipe_id}/actions",
            json={
                "type": "unscrewing",
                "parameters": {
                    "mode": "specific",
                    "target": {"x": 120, "y": 80},
                },
            },
        ).json()
        second_action_id = recipe["actions"][1]["id"]

        moved = self.client.post(
            f"/recipes/{recipe_id}/actions/{second_action_id}/move",
            json={"position": 0},
        )
        self.assertEqual(moved.status_code, 200)
        self.assertEqual(moved.json()["actions"][0]["id"], second_action_id)
        self.assertEqual(moved.json()["actions"][1]["id"], first_action_id)

        exported = self.client.get(f"/recipes/{recipe_id}/export")
        self.assertEqual(exported.status_code, 200)
        self.assertEqual(exported.json()["schema_version"], "1.0")
        self.assertIn("id", exported.json()["actions"][0])
        self.assertIn("parameters", exported.json()["actions"][0])

        preview = self.client.post(
            f"/recipes/{recipe_id}/robot-commands/preview?vendor=company_a"
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["commands"][0]["operation"], "unscrew")
        self.assertEqual(preview.json()["commands"][1]["operation"], "capture_image")

    def test_action_validation_is_fail_fast(self):
        recipe_id = self.client.post("/recipes", json={"name": "Invalid target"}).json()["id"]

        response = self.client.post(
            f"/recipes/{recipe_id}/actions",
            json={
                "type": "unscrewing",
                "parameters": {
                    "mode": "specific",
                    "target": {"x": -1, "y": 0},
                },
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_empty_recipe_cannot_be_exported(self):
        recipe_id = self.client.post("/recipes", json={"name": "Empty recipe"}).json()["id"]

        response = self.client.get(f"/recipes/{recipe_id}/export")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "invalid_recipe")
        self.assertEqual(response.json()["detail"]["errors"][0]["path"], "actions")

    def test_import_recipe_json_creates_editable_recipe(self):
        response = self.client.post(
            "/recipes/import",
            json={
                "schema_version": "1.0",
                "name": "Imported",
                "actions": [
                    {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "type": "take_image",
                        "parameters": {
                            "include_pointcloud": False,
                            "image_scope": "full_battery",
                        },
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json()["actions"][0]["id"], "11111111-1111-1111-1111-111111111111"
        )

    def test_openapi_spec_is_presentable(self):
        schema = self.client.get("/openapi.json").json()

        self.assertEqual(schema["info"]["title"], "r3-recipe-manager API")
        self.assertIn("API-first recipe manager", schema["info"]["summary"])

        paths = schema["paths"]
        self.assertEqual(paths["/recipes"]["get"]["operationId"], "listRecipes")
        self.assertEqual(paths["/recipes"]["post"]["summary"], "Create Recipe")
        self.assertEqual(paths["/recipes/{recipe_id}/actions"]["post"]["operationId"], "addRecipeAction")
        self.assertIn(
            "Action envelope",
            paths["/recipes/{recipe_id}/actions"]["post"]["description"],
        )
        self.assertEqual(
            paths["/recipes/{recipe_id}/robot-commands/preview"]["post"]["tags"],
            ["robot adapters"],
        )
        self.assertIn(
            "vendor-specific command plan",
            paths["/recipes/{recipe_id}/robot-commands/preview"]["post"]["description"],
        )
        self.assertIn(
            "Recipe JSON",
            paths["/recipes/{recipe_id}/export"]["get"]["summary"],
        )
        self.assertEqual(
            schema["components"]["schemas"]["RecipeDocument"]["properties"]["schema_version"]["description"],
            "Recipe JSON schema version. Used to evolve the portable format safely.",
        )
        self.assertIn("actions", schema["components"]["schemas"]["RecipeDocument"]["properties"])


if __name__ == "__main__":
    unittest.main()
