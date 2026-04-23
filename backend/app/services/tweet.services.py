from backend.app.db.database import (
    tagged_collection,
    untagged_collection,
    processed_collection,
    users_collection,
    mock_collection,
)
from fastapi import HTTPException
from bson import ObjectId


async def getTweetFromCollection(id: str, collection):
    tweet = await collection.find_one({"_id": ObjectId(id)})
    if not tweet:
        raise HTTPException(404, "Tweet not found")
    return tweet
