from pydantic import BaseModel
from typing import Optional


class AITweetConsultRequest(BaseModel):
    content: str
    model_is_dangerous: Optional[bool] = None
    model_category: Optional[str] = None
    user_question: Optional[str] = None


class AITweetConsultResponse(BaseModel):
    direct_answer_to_user: str
    ai_is_dangerous: bool
    ai_category: str
    confidence: float
    explanation: str
    exposed_weakness: Optional[str] = None
    agrees_with_model: Optional[bool] = None
    disagreement_reason: Optional[str] = None