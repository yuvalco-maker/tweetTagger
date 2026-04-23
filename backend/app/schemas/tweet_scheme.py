from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class TweetSchema(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    uploaded_by: str
    content: str
    created_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class MLTageedTweet(BaseModel):
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


class TweetinDB(TweetSchema):
    status: str = "pending"
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    tagged_by: Optional[str] = None
    tagged_at: Optional[datetime] = None
    is_dangerous: Optional[bool] = None
    category: Optional[str] = None

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
