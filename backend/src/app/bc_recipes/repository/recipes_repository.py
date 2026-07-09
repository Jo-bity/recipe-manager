from contextlib import closing
from datetime import datetime
import json
import sqlite3
from uuid import UUID

from app.bc_recipes.domain.recipe import Recipe, RecipeDocument


class SqliteRecipesRepository:
    def __init__(self, db_path: str):
        self.db_path = db_path

        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """CREATE TABLE IF NOT EXISTS recipes (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    recipe_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )"""
            )
            conn.commit()

    def list_recipes(self) -> list[Recipe]:
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, recipe_json, created_at, updated_at FROM recipes ORDER BY updated_at DESC"
            )
            return [self._row_to_recipe(row) for row in cursor.fetchall()]

    def get_recipe(self, recipe_id: UUID) -> Recipe | None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, recipe_json, created_at, updated_at FROM recipes WHERE id = ?",
                (str(recipe_id),),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return self._row_to_recipe(row)

    def save_recipe(self, recipe: Recipe) -> Recipe:
        document = RecipeDocument(name=recipe.name, actions=recipe.actions)
        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO recipes (id, name, recipe_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    recipe_json = excluded.recipe_json,
                    updated_at = excluded.updated_at""",
                (
                    str(recipe.id),
                    recipe.name,
                    document.model_dump_json(),
                    recipe.created_at.isoformat(),
                    recipe.updated_at.isoformat(),
                ),
            )
            conn.commit()
        return recipe

    def delete_recipe(self, recipe_id: UUID) -> bool:
        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM recipes WHERE id = ?", (str(recipe_id),))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted

    def _row_to_recipe(self, row: sqlite3.Row) -> Recipe:
        document = RecipeDocument.model_validate(json.loads(row["recipe_json"]))
        return Recipe(
            id=UUID(row["id"]),
            schema_version=document.schema_version,
            name=row["name"],
            actions=document.actions,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
