import os
import math
import asyncio
from datetime import datetime, timezone

from apify_client import ApifyClient
from dotenv import load_dotenv
from fastapi import HTTPException, status
from bson import ObjectId

from backend.app.db.database import (
    tweets_collection,
    processed_collection,
    tweet_search_queries_collection,
    users_collection,
    model_stats_collection,
)
from backend.app.schemas.tweet_scheme import FetchTweetsRequest, TweetinDB
from backend.app.services.ml.prediction_service import predict_tweets_by_query
from backend.app.services.embedding_service import (
    create_query_embedding,
    build_query_embedding_text,
    OPENAI_EMBEDDING_MODEL,
)

load_dotenv()

APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")
ACTOR_ID = "apidojo/tweet-scraper"


def parse_created_at(date_str: str) -> datetime:
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")


def clean_keywords(keywords: list[str]) -> list[str]:
    cleaned = []

    for keyword in keywords:
        keyword = keyword.strip()
        if keyword:
            cleaned.append(keyword)

    if not cleaned:
        raise ValueError("At least one valid keyword is required")

    return cleaned


def extract_author_info(item: dict):
    author = item.get("author") or {}

    username = (
        author.get("userName")
        or author.get("username")
        or item.get("username")
        or item.get("userName")
    )

    author_name = author.get("name") or item.get("authorName") or item.get("name")

    return username, author_name


def extract_tweet_url(item: dict):
    return item.get("url") or item.get("twitterUrl") or item.get("link")


def extract_tweet_id(item: dict):
    tweet_id = item.get("id") or item.get("tweetId") or item.get("twitterId")

    if tweet_id:
        return str(tweet_id)

    return None


def run_apify_actor(run_input: dict):
    client = ApifyClient(APIFY_API_TOKEN)

    run = client.actor(ACTOR_ID).call(run_input=run_input)
    dataset_id = run["defaultDatasetId"]

    return client.dataset(dataset_id).list_items().items


async def build_query_stats(query_id: str):
    cursor = processed_collection.find(
        {
            "query_id": query_id,
            "is_dangerous": {"$ne": None},
            "category": {"$ne": None},
        }
    )

    total = 0
    dangerous_count = 0
    not_dangerous_count = 0

    categories_total = {}
    categories_dangerous = {}
    categories_not_dangerous = {}

    async for tweet in cursor:
        total += 1

        category = tweet.get("category") or "Unknown"
        is_dangerous = tweet.get("is_dangerous")

        categories_total[category] = categories_total.get(category, 0) + 1

        if is_dangerous is True:
            dangerous_count += 1
            categories_dangerous[category] = (
                categories_dangerous.get(category, 0) + 1
            )
        else:
            not_dangerous_count += 1
            categories_not_dangerous[category] = (
                categories_not_dangerous.get(category, 0) + 1
            )

    dangerous_percentage = 0
    if total > 0:
        dangerous_percentage = round((dangerous_count / total) * 100, 2)

    return {
        "dangerous_count": dangerous_count,
        "not_dangerous_count": not_dangerous_count,
        "dangerous_percentage": dangerous_percentage,
        "categories_total": categories_total,
        "categories_dangerous": categories_dangerous,
        "categories_not_dangerous": categories_not_dangerous,
    }


async def fetch_tweets_from_apify(
    request: FetchTweetsRequest,
    current_user: dict,
):
    if not APIFY_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="APIFY_API_TOKEN is missing from environment variables",
        )

    user_id = str(current_user["_id"])
    keywords = clean_keywords(request.keywords)

    embedding_text = None
    embedding_vector = None
    embedding_model = None

    try:
        embedding_text = build_query_embedding_text(
            keywords=keywords,
            language=request.language,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        embedding_vector = await create_query_embedding(
            keywords=keywords,
            language=request.language,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        if embedding_vector:
            embedding_model = OPENAI_EMBEDDING_MODEL

    except Exception as e:
        print(f"Embedding generation failed: {e}")

    query_doc = {
        "keywords": keywords,
        "language": request.language,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "max_items": request.max_items,
        "requested_by": user_id,
        "requested_at": datetime.now(timezone.utc),
        "inserted_count": 0,
        "ml_processed_count": 0,
        "status": "running",

        "embedding_text": embedding_text,
        "embedding_vector": embedding_vector,
        "embedding_model": embedding_model,

        "dangerous_count": 0,
        "not_dangerous_count": 0,
        "dangerous_percentage": 0,
        "categories_total": {},
        "categories_dangerous": {},
        "categories_not_dangerous": {},
    }

    query_result = await tweet_search_queries_collection.insert_one(query_doc)
    query_id = str(query_result.inserted_id)

    run_input = {
        "searchTerms": keywords,
        "maxItems": request.max_items,
        "sort": "Latest",
        "tweetLanguage": request.language,
        "startDate": request.start_date,
        "endDate": request.end_date,
    }

    try:
        items = await asyncio.to_thread(run_apify_actor, run_input)
    except Exception as e:
        await tweet_search_queries_collection.update_one(
            {"_id": query_result.inserted_id},
            {"$set": {"status": "failed"}},
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch tweets from Apify: {str(e)}",
        )

    inserted_docs = []

    for item in items:
        text = item.get("text")
        created_at = item.get("createdAt")

        if not text or not created_at:
            continue

        try:
            created_at_dt = parse_created_at(created_at)
        except Exception:
            continue

        tweet_id = extract_tweet_id(item)
        url = extract_tweet_url(item)
        username, author_name = extract_author_info(item)

        doc = {
            "uploaded_by": "apify",
            "content": text,
            "created_at": created_at_dt,
            "tweet_id": tweet_id,
            "url": url,
            "username": username,
            "author_name": author_name,
            "language": request.language,
            "query_id": query_id,
            "search_keywords": keywords,
            "search_start_date": request.start_date,
            "search_end_date": request.end_date,
            "fetched_by": user_id,
            "fetched_at": datetime.now(timezone.utc),
            "status": "pending",
            "locked_at": None,
            "locked_by": None,
            "tagged_by": None,
            "tagged_at": None,
            "is_dangerous": None,
            "category": None,
            "confidence": None,
        }

        if tweet_id:
            existing = await tweets_collection.find_one({"tweet_id": tweet_id})
            if existing:
                continue

        result = await tweets_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        inserted_docs.append(doc)

    ml_results = await predict_tweets_by_query(query_id)
    query_stats = await build_query_stats(query_id)

    await tweet_search_queries_collection.update_one(
        {"_id": query_result.inserted_id},
        {
            "$set": {
                "inserted_count": len(inserted_docs),
                "ml_processed_count": len(ml_results),
                "status": "completed",
                **query_stats,
            }
        },
    )

    return {
        "message": "Tweets fetched, stored, and auto-processed by ML",
        "query_id": query_id,
        "pulled_count": len(items),
        "inserted_count": len(inserted_docs),
        "ml_processed_count": len(ml_results),
        "tweets": [TweetinDB(**doc) for doc in inserted_docs],
        "ml_results": ml_results,
    }


async def get_my_fetched_tweets(current_user: dict, limit: int = 50):
    user_id = str(current_user["_id"])

    cursor = (
        tweets_collection.find({"fetched_by": user_id})
        .sort("fetched_at", -1)
        .limit(limit)
    )

    tweets = []

    async for doc in cursor:
        tweets.append(TweetinDB.from_mongo(doc))

    return tweets


async def get_my_search_queries(current_user: dict, limit: int = 50):
    user_id = str(current_user["_id"])

    cursor = (
        tweet_search_queries_collection.find({"requested_by": user_id})
        .sort("requested_at", -1)
        .limit(limit)
    )

    queries = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])

        # לא מחזירים את הוקטור לפרונט כי הוא ענק
        doc.pop("embedding_vector", None)

        queries.append(doc)

    return queries


async def get_my_tweets_by_query(query_id: str):
    cursor = processed_collection.find({"query_id": query_id}).sort("fetched_at", -1)

    tweets = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        tweets.append(doc)

    return tweets


async def get_queries_by_username(username: str, limit: int = 50):
    user = await users_collection.find_one({"username": username})

    if not user:
        raise ValueError("User not found")

    user_id = str(user["_id"])

    cursor = (
        tweet_search_queries_collection.find({"requested_by": user_id})
        .sort("requested_at", -1)
        .limit(limit)
    )

    queries = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["username"] = user.get("username")

        # לא מחזירים את הוקטור לפרונט כי הוא ענק
        doc.pop("embedding_vector", None)

        queries.append(doc)

    return queries


async def get_global_processed_stats():
    cursor = processed_collection.find(
        {
            "is_dangerous": {"$ne": None},
            "category": {"$ne": None},
        }
    )

    total = 0
    dangerous_count = 0
    not_dangerous_count = 0

    categories_total = {}
    categories_dangerous = {}
    categories_not_dangerous = {}

    async for tweet in cursor:
        total += 1

        category = tweet.get("category") or "Unknown"
        is_dangerous = tweet.get("is_dangerous")

        categories_total[category] = categories_total.get(category, 0) + 1

        if is_dangerous is True:
            dangerous_count += 1
            categories_dangerous[category] = categories_dangerous.get(category, 0) + 1
        else:
            not_dangerous_count += 1
            categories_not_dangerous[category] = (
                categories_not_dangerous.get(category, 0) + 1
            )

    def percentage(count: int, base: int):
        if base == 0:
            return 0
        return round((count / base) * 100, 2)

    def build_category_stats(category_dict: dict, base: int):
        return [
            {
                "category": category,
                "count": count,
                "percentage": percentage(count, base),
            }
            for category, count in category_dict.items()
        ]

    return {
        "total_ml_tagged": total,
        "dangerous": {
            "count": dangerous_count,
            "percentage": percentage(dangerous_count, total),
        },
        "not_dangerous": {
            "count": not_dangerous_count,
            "percentage": percentage(not_dangerous_count, total),
        },
        "categories_total": build_category_stats(categories_total, total),
        "categories_dangerous": build_category_stats(
            categories_dangerous,
            dangerous_count,
        ),
        "categories_not_dangerous": build_category_stats(
            categories_not_dangerous,
            not_dangerous_count,
        ),
    }


_HIDDEN_FIELDS = {"tagged_by"}

def _clean(doc: dict) -> dict:
    for f in _HIDDEN_FIELDS:
        doc.pop(f, None)
    return doc


async def get_all_processed_tweets(skip: int = 0, limit: int = 50):
    total = await processed_collection.count_documents({})
    cursor = processed_collection.find({}).sort("fetched_at", -1).skip(skip).limit(limit)
    tweets = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        tweets.append(_clean(doc))
    return {"tweets": tweets, "total": total}


async def get_tweet(tweet_id: str):
    tweet = await processed_collection.find_one({"tweet_id": tweet_id})

    if not tweet:
        raise HTTPException(status_code=404, detail="Tweet not found")

    tweet["_id"] = str(tweet["_id"])
    return _clean(tweet)


async def update_tweet(tweet, user_id: str | None = None):
    data = await processed_collection.find_one({"_id": ObjectId(tweet["_id"])})

    if not data:
        raise HTTPException(status_code=404, detail="Tweet not found")

    danger = tweet["is_dangerous"]
    cat = tweet["category"]

    if data["is_dangerous"] == danger and cat == data["category"]:
        data["_id"] = str(data["_id"])
        return _clean(data)

    original_cat = data.get("original_category")
    original_danger = data.get("original_is_dangerous")

    reverted_to_original = (
        original_cat is not None
        and original_danger is not None
        and cat == original_cat
        and danger == original_danger
    )

    edited_flag = not reverted_to_original

    fields = {
        "category": cat,
        "is_dangerous": danger,
        "edited": edited_flag,
    }
    if user_id:
        fields["tagged_by"] = user_id

    res = await processed_collection.update_one(
        {"_id": ObjectId(tweet["_id"])},
        {"$set": fields},
    )

    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Tweet not found")

    was_edited = bool(data.get("edited"))
    if edited_flag and not was_edited:
        await model_stats_collection.update_one(
            {"_id": "singleton"},
            {"$inc": {"edit_count": 1}},
            upsert=True,
        )
    elif not edited_flag and was_edited:
        await model_stats_collection.update_one(
            {"_id": "singleton"},
            {"$inc": {"edit_count": -1}},
            upsert=True,
        )

    data["category"] = cat
    data["is_dangerous"] = danger
    data["edited"] = edited_flag
    data["_id"] = str(data["_id"])

    return _clean(data)
def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    if not vec1 or not vec2:
        return 0

    if len(vec1) != len(vec2):
        return 0

    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0

    return dot / (norm1 * norm2)


def normalize_percentage(value):
    if value is None:
        return 0

    return min(max(value / 100, 0), 1)


async def get_similar_queries(query_id: str, limit: int = 5):
    source_query = await tweet_search_queries_collection.find_one(
        {"_id": ObjectId(query_id)}
    )

    if not source_query:
        raise HTTPException(status_code=404, detail="Query not found")

    source_embedding = source_query.get("embedding_vector")

    if not source_embedding:
        raise HTTPException(
            status_code=400,
            detail="This query does not have an embedding vector",
        )

    cursor = tweet_search_queries_collection.find(
        {
            "_id": {"$ne": ObjectId(query_id)},
            "embedding_vector": {"$exists": True, "$ne": None},
        }
    )

    results = []

    async for other in cursor:
        other_embedding = other.get("embedding_vector")

        similarity = cosine_similarity(source_embedding, other_embedding)

        dangerous_score = normalize_percentage(
            other.get("dangerous_percentage")
        )

        final_score = round(
            0.7 * similarity + 0.3 * dangerous_score,
            4,
        )

        results.append(
            {
                "query_id": str(other["_id"]),
                "keywords": other.get("keywords"),
                "language": other.get("language"),
                "start_date": other.get("start_date"),
                "end_date": other.get("end_date"),
                "inserted_count": other.get("inserted_count", 0),
                "ml_processed_count": other.get("ml_processed_count", 0),
                "dangerous_count": other.get("dangerous_count", 0),
                "not_dangerous_count": other.get("not_dangerous_count", 0),
                "dangerous_percentage": other.get("dangerous_percentage", 0),
                "categories_total": other.get("categories_total", {}),
                "categories_dangerous": other.get("categories_dangerous", {}),
                "similarity": round(similarity, 4),
                "final_score": final_score,
                "reason": {
                    "semantic_similarity": round(similarity, 4),
                    "dangerous_score": round(dangerous_score, 4),
                    "formula": "0.7 * semantic_similarity + 0.3 * dangerous_score",
                },
            }
        )

    results.sort(key=lambda x: x["final_score"], reverse=True)

    return {
        "source_query": {
            "query_id": str(source_query["_id"]),
            "keywords": source_query.get("keywords"),
            "language": source_query.get("language"),
            "start_date": source_query.get("start_date"),
            "end_date": source_query.get("end_date"),
        },
        "recommendations": results[:limit],
    }
async def get_smart_query_suggestions(
    request: FetchTweetsRequest,
    limit: int = 5,
):
    keywords = clean_keywords(request.keywords)

    source_embedding = await create_query_embedding(
        keywords=keywords,
        language=request.language,
        start_date=request.start_date,
        end_date=request.end_date,
    )

    if not source_embedding:
        raise HTTPException(
            status_code=400,
            detail="Could not create embedding for this query idea",
        )

    cursor = tweet_search_queries_collection.find(
        {
            "embedding_vector": {"$exists": True, "$ne": None},
        }
    )

    results = []

    async for other in cursor:
        other_embedding = other.get("embedding_vector")
        similarity = cosine_similarity(source_embedding, other_embedding)

        dangerous_percentage = other.get("dangerous_percentage") or 0
        dangerous_score = normalize_percentage(dangerous_percentage)

        final_score = round(
            0.7 * similarity + 0.3 * dangerous_score,
            4,
        )

        results.append(
            {
                "query_id": str(other["_id"]),
                "keywords": other.get("keywords") or [],
                "language": other.get("language") or request.language,
                "start_date": other.get("start_date") or request.start_date,
                "end_date": other.get("end_date") or request.end_date,
                "max_items": other.get("max_items") or request.max_items,
                "inserted_count": other.get("inserted_count") or 0,
                "ml_processed_count": other.get("ml_processed_count") or 0,
                "dangerous_count": other.get("dangerous_count") or 0,
                "not_dangerous_count": other.get("not_dangerous_count") or 0,
                "dangerous_percentage": dangerous_percentage,
                "categories_total": other.get("categories_total") or {},
                "categories_dangerous": other.get("categories_dangerous") or {},
                "categories_not_dangerous": other.get("categories_not_dangerous") or {},
                "similarity": round(similarity, 4),
                "dangerous_score": round(dangerous_score, 4),
                "final_score": final_score,
                "reason": {
                    "semantic_similarity": round(similarity, 4),
                    "dangerous_score": round(dangerous_score, 4),
                    "formula": "0.7 * semantic_similarity + 0.3 * dangerous_score",
                },
            }
        )

    results.sort(key=lambda item: item["final_score"], reverse=True)

    return {
        "input_query": {
            "keywords": keywords,
            "language": request.language,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "max_items": request.max_items,
        },
        "recommendations": results[:limit],
    }