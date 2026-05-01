from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


class PredictionResult(BaseModel):
    is_dangerous: bool
    category: str


class MLTaggedTweet(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

    uploaded_by: Optional[str] = None
    content: str
    created_at: datetime

    tweet_id: Optional[str] = None
    url: Optional[str] = None
    username: Optional[str] = None
    author_name: Optional[str] = None
    language: Optional[str] = None

    query_id: Optional[str] = None
    search_keywords: Optional[list[str]] = None
    search_start_date: Optional[str] = None
    search_end_date: Optional[str] = None

    fetched_by: Optional[str] = None
    fetched_at: Optional[datetime] = None

    is_dangerous: Optional[bool] = None
    original_is_dangerous: Optional[bool] = None
    original_category: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    status: Optional[str] = None
    edited: Optional[bool] = False

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
        extra="ignore",
    )
