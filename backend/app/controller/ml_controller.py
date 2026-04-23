from fastapi import APIRouter, Depends

from backend.app.db.database import db, mock_collection
from backend.app.schemas.ml_schema import MLTaggedTweet
from backend.app.services.ml.prediction_service import predict_tweet_by_id
from backend.app.dependencies.auth import get_current_user

ml_router = APIRouter(prefix="/ml", tags=["ML"])


@ml_router.get("/predict/{tweet_id}", response_model=MLTaggedTweet)
async def predict_tweet(tweet_id: str, current_user: dict = Depends(get_current_user)):
    res = await predict_tweet_by_id(tweet_id, mock_collection)
    return res
