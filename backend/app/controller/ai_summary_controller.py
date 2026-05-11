from fastapi import APIRouter, Depends, HTTPException

from backend.app.dependencies.auth import get_current_user
from backend.app.services.ai_summary_service import (
    get_or_create_ai_summary_for_query,
)


ai_summary_router = APIRouter(
    prefix="/ai-summary",
    tags=["AI Summary"],
)


@ai_summary_router.post("/query/{query_id}")
async def create_or_get_ai_summary(
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await get_or_create_ai_summary_for_query(
            query_id=query_id,
            current_user=current_user,
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )