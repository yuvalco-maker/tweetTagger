import os
import asyncio
from datetime import datetime, timezone

from apify_client import ApifyClient
from dotenv import load_dotenv
from fastapi import HTTPException, status
from backend.app.db.database import (
    tweets_collection,
    processed_collection,
    tweet_search_queries_collection,
    users_collection,
)
from backend.app.schemas.tweet_scheme import FetchTweetsRequest, TweetinDB
from backend.app.services.ml.prediction_service import predict_tweets_by_query
from bson import ObjectId

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

    query_doc = {
        "keywords": keywords,
        "language": request.language,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "max_items": request.max_items,
        "requested_by": user_id,
        "requested_at": datetime.now(timezone.utc),
        "inserted_count": 0,
        "status": "running",
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

    await tweet_search_queries_collection.update_one(
        {"_id": query_result.inserted_id},
        {
            "$set": {
                "inserted_count": len(inserted_docs),
                "ml_processed_count": len(ml_results),
                "status": "completed",
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


async def get_tweet(tweet_id: str):
    tweet = await processed_collection.find_one({"tweet_id": tweet_id})
    if not tweet:
        raise HTTPException(status_code=404, detail="Tweet not found")
    tweet["_id"] = str(tweet["_id"])
    return tweet


async def update_tweet(tweet):

    data = await processed_collection.find_one({"_id": ObjectId(tweet["_id"])})
    if not data:
        raise HTTPException(status_code=404, detail="Tweet not found")
    danger = tweet["is_dangerous"]
    cat = tweet["category"]
    if data["is_dangerous"] == danger and cat == data["category"]:
        data["_id"] = str(data["_id"])
        return data

    original_cat = data.get("original_category")
    original_danger = data.get("original_is_dangerous")
    reverted_to_original = (
        original_cat is not None
        and original_danger is not None
        and cat == original_cat
        and danger == original_danger
    )
    edited_flag = not reverted_to_original

    res = await processed_collection.update_one(
        {"_id": ObjectId(tweet["_id"])},
        {"$set": {"category": cat, "is_dangerous": danger, "edited": edited_flag}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Tweet not found")

    data["category"] = cat
    data["is_dangerous"] = danger
    data["edited"] = edited_flag
    data["_id"] = str(data["_id"])
    return data
