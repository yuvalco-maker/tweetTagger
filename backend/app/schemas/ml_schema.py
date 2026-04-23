from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone


class PredictionResult(BaseModel):
    is_dangerous: bool
    category: str


class MLTaggedTweet(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    uploaded_by: str
    content: str
    created_at: datetime
    is_dangerous: Optional[bool] = None
    category: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
        extra="ignore",
    )
