from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, timezone


def _now_utc():
    return datetime.now(timezone.utc)


class AITweetReview(BaseModel):
    tweet_id: Optional[str] = None
    db_id: Optional[str] = None
    content: str

    model_is_dangerous: Optional[bool] = None
    model_category: Optional[str] = None

    ai_agrees_with_model: bool
    ai_is_dangerous: bool
    ai_category: str

    exposed_weakness: Optional[str] = None
    disagreement_reason: Optional[str] = None
    short_explanation: str


class AIQuerySummaryCreate(BaseModel):
    query_id: str


class AIQuerySummaryInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

    query_id: str
    requested_by: Optional[str] = None

    general_summary: str
    overall_risk_level: str
    main_exposed_weaknesses: List[str]
    recommended_action: str

    tweets_reviewed_count: int
    dangerous_count_by_ai: int
    disagreements_count: int

    tweet_reviews: List[AITweetReview]

    created_at: datetime = Field(default_factory=_now_utc)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="ignore",
    )

    @classmethod
    def from_mongo(cls, data: dict):
        if not data:
            return None

        if "_id" in data:
            data["_id"] = str(data["_id"])

        return cls(**data)