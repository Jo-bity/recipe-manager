from typing import Any

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "invalid_request",
                "message": "Request validation failed.",
                "errors": [_validation_error_detail(error) for error in exc.errors()],
            }
        },
    )


def _validation_error_detail(error: dict[str, Any]) -> dict[str, str]:
    return {
        "path": _validation_path(error.get("loc", ())),
        "message": str(error.get("msg", "Invalid value.")),
    }


def _validation_path(location: tuple[Any, ...]) -> str:
    parts = [part for part in location if part != "body"]
    path = ""
    for part in parts:
        if isinstance(part, int):
            path = f"{path}[{part}]"
            continue
        if path:
            path += "."
        path += str(part)
    return path or "request"


app.include_router(recipes_router)
