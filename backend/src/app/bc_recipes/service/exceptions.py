from dataclasses import dataclass


@dataclass
class FieldError:
    path: str
    message: str


class RecipeError(Exception):
    pass


class InvalidRecipe(RecipeError):
    def __init__(self, message: str, errors: list[FieldError]):
        super().__init__(message)
        self.message = message
        self.errors = errors


class RecipeNotFound(RecipeError):
    pass


class StepNotFound(RecipeError):
    pass


class OrderConflict(RecipeError):
    pass


class UnsupportedVendor(RecipeError):
    pass
