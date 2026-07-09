from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bc_recipes.api.recipes_rest_api import router as recipes_router


app = FastAPI(title="r3-recipe-manager API")

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
