from bson import ObjectId
from fastapi import APIRouter, HTTPException

from backend.app.db.database import db
from backend.app.schemas.ml_schema import MLTaggedTweet
from backend.app.services.ml.prediction_service import predict_tweet

ml_router = APIRouter(prefix="/ml", tags=["ML"])


@ml_router.get("/predict/{tweet_id}", response_model=MLTaggedTweet)
async def predict_tweet_by_id(tweet_id: str):