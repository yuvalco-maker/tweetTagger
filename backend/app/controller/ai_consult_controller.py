from fastapi import APIRouter, Depends, HTTPException

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.ai_consult_schema import (
    AITweetConsultRequest,
    AITweetConsultResponse,
)
from backend.app.services.ai_consult_service import consult_ai_about_tweet


ai_consult_router = APIRouter(
    prefix="/ai-consult",
    tags=["AI Consult"],
)


@ai_consult_router.post("/tweet", response_model=AITweetConsultResponse)
async def consult_tweet_with_ai(
    request: AITweetConsultRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await consult_ai_about_tweet(request)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )