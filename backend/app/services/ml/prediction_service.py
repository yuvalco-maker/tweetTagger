from backend.app.schemas.ml_schema import MLTaggedTweet
from backend.app.services.ml.mock_predictor import predict_from_text_mock
from backend.app.services.tweet_services import getTweetFromCollection
from backend.app.db.database import processed_collection, mock_collection


async def predict_tweet_by_id(tweet_id, collection):

    tweet = await getTweetFromCollection(tweet_id, collection)

    text = tweet["content"]

    prediction = predict_from_text_mock(text)

    tweet["is_dangerous"] = prediction.is_dangerous
    tweet["category"] = prediction.category
    tweet["_id"] = str(tweet["_id"])

    ml_tweet = MLTaggedTweet(**tweet)
    data = ml_tweet.dict(by_alias=True)
    data.pop("_id", None)
    res = await processed_collection.insert_one(data)
    data["_id"] = str(res.inserted_id)
    return MLTaggedTweet(**data)
