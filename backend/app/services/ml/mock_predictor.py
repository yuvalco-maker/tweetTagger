import random

from backend.app.schemas.ml_schema import PredictionResult


CATEGORIES_SAFE = ["Oil", "Electricity", "Gas", "Other"]
CATEGORIES = ["Oil", "Electricity", "Gas"]


def predict_from_text_mock(text: str) -> PredictionResult:
    danger = random.choice([True, False])
    if not danger:
        cat = CATEGORIES_SAFE
    else:
        cat = CATEGORIES

    return PredictionResult(is_dangerous=danger, category=random.choice(cat))
