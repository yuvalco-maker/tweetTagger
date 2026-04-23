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
    obj_id = ObjectId(id)

    print("DB:", collection.database.name)
    print("COLLECTION:", collection.name)
    print("COUNT:", await collection.count_documents({}))
    print("FOUND BY ID:", await collection.find_one({"_id": obj_id}) is not None)

    tweet = await collection.find_one({"_id": obj_id})

    if not tweet:
        raise HTTPException(status_code=404, detail="Tweet not found")

    return tweet
