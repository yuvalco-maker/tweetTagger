import os
import json
import asyncio

from openai import OpenAI
from fastapi import HTTPException, status

from backend.app.schemas.ai_consult_schema import (
    AITweetConsultRequest,
    AITweetConsultResponse,
)


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


AI_CONSULT_JSON_SCHEMA = {
    "name": "tweet_ai_consultation",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "direct_answer_to_user": {"type": "string"},
            "ai_is_dangerous": {"type": "boolean"},
            "ai_category": {
                "type": "string",
                "enum": ["Oil", "Electricity", "Gas", "Other"],
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
            },
            "explanation": {"type": "string"},
            "exposed_weakness": {"type": ["string", "null"]},
            "agrees_with_model": {"type": ["boolean", "null"]},
            "disagreement_reason": {"type": ["string", "null"]},
        },
        "required": [
            "direct_answer_to_user",
            "ai_is_dangerous",
            "ai_category",
            "confidence",
            "explanation",
            "exposed_weakness",
            "agrees_with_model",
            "disagreement_reason",
        ],
    },
    "strict": True,
}


def _call_openai_sync(request: AITweetConsultRequest):
    prompt = f"""
You are an AI assistant inside a tweet-labeling app.

You have TWO jobs:
1. Answer the user's message directly, even if it is casual, emotional, unclear, strange, or partly unrelated.
2. Help label the tweet for an infrastructure-risk dataset.

VERY IMPORTANT:
- direct_answer_to_user MUST answer the user's actual message directly.
- If the user writes casually, respond naturally and kindly.
- If the user asks a weird or unrelated question, answer it briefly, then still help with the tagging.
- Do not ignore the user's message.
- explanation should explain the tagging decision only.
- direct_answer_to_user should feel like a real assistant response.

Dangerous means:
The tweet may expose sensitive infrastructure information, operational weakness, location, outage, damage, vulnerability, or exploitable information.

Allowed categories:
- Oil
- Electricity
- Gas
- Other

Rules:
- If ai_is_dangerous is true, ai_category should usually be Oil, Electricity, or Gas.
- Use Other mainly when the tweet is not dangerous or not related enough.
- If the tweet is not dangerous, exposed_weakness must be null.
- If you disagree with the current model tagging, explain why in disagreement_reason.
- If you agree with the current model tagging, disagreement_reason should be null.
- confidence should be between 0 and 1.

Tweet:
{request.content}

Current tagging shown to the user:
is_dangerous: {request.model_is_dangerous}
category: {request.model_category}

User message:
{request.user_question or "The user did not ask a specific question. Give tagging guidance."}

Return JSON only.
"""

    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=[
            {
                "role": "system",
                "content": "Return only JSON matching the provided schema.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": AI_CONSULT_JSON_SCHEMA["name"],
                "schema": AI_CONSULT_JSON_SCHEMA["schema"],
                "strict": True,
            }
        },
    )

    return json.loads(response.output_text)


async def consult_ai_about_tweet(
    request: AITweetConsultRequest,
) -> AITweetConsultResponse:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is missing from environment variables",
        )

    if not request.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tweet content is required",
        )

    ai_data = await asyncio.to_thread(_call_openai_sync, request)

    return AITweetConsultResponse(**ai_data)