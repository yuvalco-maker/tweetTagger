from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.tweet_scheme import FetchTweetsRequest
from backend.app.schemas.ml_schema import MLTaggedTweet
from backend.app.services.tweet_fetch_service import (
    fetch_tweets_from_apify,
    get_my_fetched_tweets,
    get_my_search_queries,
    get_my_tweets_by_query,
    get_queries_by_username,
    get_global_processed_stats,
    get_tweet,
    update_tweet,
)

tweet_fetch_router = APIRouter(
    prefix="/tweet-fetch",
    tags=["Tweet Fetch"],
)


@tweet_fetch_router.post("/fetch")
async def fetch_tweets(
    request: FetchTweetsRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await fetch_tweets_from_apify(request, current_user)
    except HTTPException as he:
        raise he
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/my-tweets")
async def get_my_tweets(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_my_fetched_tweets(current_user, limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/my-queries")
async def get_my_queries(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_my_search_queries(current_user, limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/query/{query_id}/tweets")
async def get_query_tweets(
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_my_tweets_by_query(query_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/user-queries")
async def get_user_queries(
    username: str = Query(..., min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_queries_by_username(username, limit)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/global-processed-stats")
async def get_global_stats(
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_global_processed_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.get("/tweet/{tweet_id}")
async def on_get_tweet(
    tweet_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_tweet(tweet_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@tweet_fetch_router.patch("/tweet/{tweet_id}")
async def on_update_tweet(
    tweet_id: str,
    tweet: MLTaggedTweet,
    current_user: dict = Depends(get_current_user),
):
    try:
        tweet_data = tweet.model_dump()
        tweet_data["_id"] = tweet_id
        return await update_tweet(tweet_data)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
