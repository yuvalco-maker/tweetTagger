from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.tweet_scheme import FetchTweetsRequest
from backend.app.services.tweet_fetch_service import (
    fetch_tweets_from_apify,
    get_my_fetched_tweets,
    get_my_search_queries,
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