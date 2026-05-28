from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.mab_schema import RewardRequest
from backend.app.services.mab_service import (
    get_historically_successful_dangerous_queries,
    get_infrastructure_keyword_queries,
    get_location_hotspot_queries,
    get_ai_generated_queries,
    get_recent_category_trend_queries,
    get_ucb1_scores,
    select_arm_ucb1,
    record_arm_reward,
)
mab_router = APIRouter(
    prefix="/mab",
    tags=["MAB"],
)


@mab_router.get("/arms/1/historical-dangerous-queries")
async def get_arm_1_historical_dangerous_queries(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_historically_successful_dangerous_queries(limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
@mab_router.get("/arms/2/infrastructure-keywords")
async def get_arm_2_infrastructure_keywords(
    limit: int = Query(default=5, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_infrastructure_keyword_queries(limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
@mab_router.get("/arms/3/location-hotspots")
async def get_arm_3_location_hotspots(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_location_hotspot_queries(limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
@mab_router.get("/arms/4/ai-query-expansion")
async def get_arm_4_ai_query_expansion(
    seed_topic: str,
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_ai_generated_queries(
            seed_topic=seed_topic,
            limit=limit,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
@mab_router.get("/arms/5/recent-category-trends")
async def get_arm_5_recent_category_trends(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_recent_category_trend_queries(limit)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )


@mab_router.get("/ucb1/scores")
async def get_all_ucb1_scores(current_user: dict = Depends(get_current_user)):
    """Returns UCB1 score for all 5 arms. Arms never pulled show ucb1_score=null (treated as infinity)."""
    try:
        return await get_ucb1_scores()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@mab_router.get("/ucb1/select")
async def select_best_ucb1_arm(current_user: dict = Depends(get_current_user)):
    """Returns the arm with the highest UCB1 score — use this to decide which arm to pull next."""
    try:
        return await select_arm_ucb1()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@mab_router.post("/ucb1/reward")
async def update_arm_reward(
    body: RewardRequest,
    current_user: dict = Depends(get_current_user),
):
    """Record a reward (0.0–1.0) for an arm after pulling it. Updates avg_reward used by UCB1."""
    try:
        return await record_arm_reward(body.arm_id, body.reward)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")