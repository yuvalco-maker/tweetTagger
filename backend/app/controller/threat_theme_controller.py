from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.dependencies.auth import get_current_user
from backend.app.services.threat_theme_service import (
    cluster_dangerous_tweets_by_category,
    cluster_all_dangerous_tweets,
)

threat_theme_router = APIRouter(
    prefix="/threat-themes",
    tags=["Threat Themes"],
)


@threat_theme_router.post("/cluster")
async def cluster_threat_themes(
    category: str = Query(..., min_length=1),
    limit: int = Query(default=200, ge=5, le=500),
    min_cluster_size: int = Query(default=5, ge=2, le=50),
    min_samples: int = Query(default=2, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await cluster_dangerous_tweets_by_category(
            category=category,
            limit=limit,
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@threat_theme_router.post("/cluster-all")
async def cluster_all_threat_themes(
    limit: int = Query(default=500, ge=5, le=1000),
    min_cluster_size: int = Query(default=5, ge=2, le=50),
    min_samples: int = Query(default=2, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await cluster_all_dangerous_tweets(
            limit=limit,
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )