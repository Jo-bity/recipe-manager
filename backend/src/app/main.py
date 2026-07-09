from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bc_recipes.api.recipes_rest_api import router as recipes_router


app = FastAPI(
    title="r3-recipe-manager API",
    summary="API-first recipe manager for robot automation recipes.",
    description=(
        "Create, validate, import, export, and preview vendor-specific command "
        "translations for vendor-neutral robot automation recipes. The API is "
        "designed for a technician-facing Recipe Manager while keeping robot "
        "execution out of the MVP scope."
    ),
    version="0.1.0",
    contact={"name": "R3 recipe manager case study"},
    openapi_tags=[
        {
            "name": "recipes",
            "description": "Create and manage vendor-neutral Recipes and their ordered Steps.",
        },
        {
            "name": "recipe validation",
            "description": "Validate Recipes before export or robot command preview.",
        },
        {
            "name": "recipe exchange",
            "description": "Import and export canonical Recipe JSON.",
        },
        {
            "name": "robot adapters",
            "description": "Preview vendor-specific command plans generated from Recipe JSON.",
        },
    ],
)

origins = [
    "http://localhost:5173",
    "localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(recipes_router)
