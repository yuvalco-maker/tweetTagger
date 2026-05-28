from pydantic import BaseModel, Field
from typing import Optional, List


class MABQueryRecommendation(BaseModel):
    query_id: str
    keywords: List[str]
    arm_id: str
    arm_name: str
    success_rate: float
    dangerous_count: int
    ml_processed_count: int
    dangerous_percentage: float
    reason: str


class MABArmResponse(BaseModel):
    arm_id: str
    arm_name: str
    recommendations: List[MABQueryRecommendation]


class RewardRequest(BaseModel):
    arm_id: str
    reward: float = Field(..., ge=0.0, le=1.0)


class UCB1ArmScore(BaseModel):
    arm_id: str
    arm_name: str
    runs: int
    avg_reward: float
    ucb1_score: Optional[float]  # None when arm was never pulled (treated as infinity)