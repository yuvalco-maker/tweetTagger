from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone


class PredictionResult(BaseModel):
    is_dangerous: bool
    category: str
