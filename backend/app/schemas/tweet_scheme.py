from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, timezone


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

class TweetLocation(BaseModel):
    place_name: str
    lat: float
    lng: float
    confidence: str  # "high", "medium", "low"


class TweetSchema(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

    uploaded_by: Optional[str] = None
    content: str
    created_at: datetime

    # Apify / original tweet metadata
    tweet_id: Optional[str] = None
    url: Optional[str] = None
    username: Optional[str] = None
    author_name: Optional[str] = None
    language: Optional[str] = None

    # Query metadata
    query_id: Optional[str] = None
    search_keywords: Optional[List[str]] = None
    search_start_date: Optional[str] = None
    search_end_date: Optional[str] = None

    fetched_by: Optional[str] = None
    fetched_at: Optional[datetime] = None
    coordinates: Optional[List[TweetLocation]] = None
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="ignore",
    )


class TweetinDB(TweetSchema):
    status: str = "pending"

    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    tagged_by: Optional[str] = None
    tagged_at: Optional[datetime] = None

    is_dangerous: Optional[bool] = None
    category: Optional[str] = None
    confidence: Optional[float] = None

    # Tweet embedding
    embedding_text: Optional[str] = None
    embedding_vector: Optional[List[float]] = None
    embedding_model: Optional[str] = None

    # Clustering / semantic groups
    cluster_id: Optional[int] = None
    cluster_label: Optional[str] = None
    cluster_summary: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
        extra="ignore",
    )

    @classmethod
    def from_mongo(cls, data: dict):
        if not data:
            return None

        if "_id" in data:
            data["_id"] = str(data["_id"])

        return cls(**data)
    @classmethod
    def from_mongo(cls, data: dict):
        if not data:
            return None

        if "_id" in data:
            data["_id"] = str(data["_id"])

        return cls(**data)


class FetchTweetsRequest(BaseModel):
    keywords: List[str] = Field(..., min_length=1)
    language: str = Field(default="en", min_length=2)
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    max_items: int = Field(default=100, ge=1, le=500)


class TweetSearchQueryInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

    keywords: List[str]
    language: str
    start_date: str
    end_date: str
    max_items: int

    requested_by: str
    requested_at: datetime = Field(default_factory=_now_utc)

    inserted_count: Optional[int] = 0
    ml_processed_count: Optional[int] = 0

    status: Optional[str] = "completed"

    # Embedding
    embedding_text: Optional[str] = None
    embedding_vector: Optional[List[float]] = None
    embedding_model: Optional[str] = None

    # Query stats
    dangerous_count: Optional[int] = 0
    not_dangerous_count: Optional[int] = 0

    dangerous_percentage: Optional[float] = 0

    categories_total: Optional[dict] = None
    categories_dangerous: Optional[dict] = None
    categories_not_dangerous: Optional[dict] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="ignore",
    )
class taggSchema(BaseModel):
    tweet_id: str
    is_dangerous: bool
    category: str
    tagged_by: str
    locked_at: datetime
    tagged_at: datetime = Field(default_factory=_now_utc)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class taggSchemaFront(BaseModel):
    is_dangerous: bool
    category: str
    tweet_id: str
    locked_at: datetime

    model_config = ConfigDict(arbitrary_types_allowed=True)


class esclateSchema(BaseModel):
    tweet_id: str
    locked_at: Optional[datetime] = None

    model_config = ConfigDict(arbitrary_types_allowed=True)