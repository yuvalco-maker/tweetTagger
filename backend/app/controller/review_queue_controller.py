from fastapi import APIRouter, Depends, HTTPException

from backend.app.dependencies.auth import get_current_user
from backend.app.services.review_queue_service import get_review_queue

review_queue_router = APIRouter(prefix="/review-queue", tags=["Review Queue"])


@review_queue_router.get("/query/{query_id}")
async def get_review_queue_for_query(
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_review_queue(query_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
