from backend.app.db.database import tweets_collection, processed_collection
from backend.app.services.ml.predictor import predict_from_text
from backend.app.schemas.ml_schema import MLTaggedTweet
from backend.app.services.tweet_services import getTweetFromCollection


async def predict_tweet_by_id(tweet_id: str, collection=processed_collection):
    tweet = await getTweetFromCollection(tweet_id, collection)

    prediction = predict_from_text(tweet["content"])

    await collection.update_one(
        {"_id": tweet["_id"]},
        {
            "$set": {
                "is_dangerous": prediction.is_dangerous,
                "category": prediction.category,
                "status": "ml_tagged",
            }
        },
    )

    tweet["is_dangerous"] = prediction.is_dangerous
    tweet["category"] = prediction.category
    tweet["original_is_dangerous"] = prediction.is_dangerous
    tweet["original_category"] = prediction.category
    tweet["status"] = "ml_tagged"
    tweet["_id"] = str(tweet["_id"])

    data = MLTaggedTweet(**tweet).model_dump(by_alias=True)
    data.pop("_id", None)

    res = await processed_collection.insert_one(data)
    data["_id"] = str(res.inserted_id)

    return MLTaggedTweet(**data)


async def predict_tweets_by_query(query_id: str):
    cursor = tweets_collection.find(
        {
            "query_id": query_id,
            "is_dangerous": None,
        }
    )

    results = []

    async for tweet in cursor:
        prediction = predict_from_text(tweet["content"])

        await tweets_collection.update_one(
            {"_id": tweet["_id"]},
            {
                "$set": {
                    "is_dangerous": prediction.is_dangerous,
                    "category": prediction.category,
                    "original_category": prediction.category,
                    "status": "ml_tagged",
                }
            },
        )

        tweet["is_dangerous"] = prediction.is_dangerous
        tweet["category"] = prediction.category
        tweet["original_is_dangerous"] = prediction.is_dangerous
        tweet["original_category"] = prediction.category
        tweet["status"] = "ml_tagged"
        tweet["_id"] = str(tweet["_id"])

        data = MLTaggedTweet(**tweet).model_dump(by_alias=True)
        data.pop("_id", None)

        res = await processed_collection.insert_one(data)
        data["_id"] = str(res.inserted_id)

        results.append(MLTaggedTweet(**data))

    return results
