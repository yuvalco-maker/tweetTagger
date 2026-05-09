import os
import json
from datetime import datetime, timezone

from openai import OpenAI
from fastapi import HTTPException, status

from backend.app.db.database import (
    processed_collection,
    ai_query_summaries_collection,
)
from backend.app.schemas.ai_summary_schema import AIQuerySummaryInDB


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


AI_SUMMARY_JSON_SCHEMA = {
    "name": "tweet_query_ai_summary",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "general_summary": {"type": "string"},
            "overall_risk_level": {
                "type": "string",
                "enum": ["low", "medium", "high"],
            },
            "main_exposed_weaknesses": {
                "type": "array",
                "items": {"type": "string"},
            },
            "recommended_action": {"type": "string"},
            "tweet_reviews": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "tweet_id": {"type": ["string", "null"]},
                        "db_id": {"type": ["string", "null"]},
                        "content": {"type": "string"},

                        "model_is_dangerous": {"type": ["boolean", "null"]},
                        "model_category": {"type": ["string", "null"]},

                        "ai_agrees_with_model": {"type": "boolean"},
                        "ai_is_dangerous": {"type": "boolean"},
                        "ai_category": {"type": "string"},

                        "exposed_weakness": {"type": ["string", "null"]},
                        "disagreement_reason": {"type": ["string", "null"]},
                        "short_explanation": {"type": "string"},
                    },
                    "required": [
                        "tweet_id",
                        "db_id",
                        "content",
                        "model_is_dangerous",
                        "model_category",
                        "ai_agrees_with_model",
                        "ai_is_dangerous",
                        "ai_category",
                        "exposed_weakness",
                        "disagreement_reason",
                        "short_explanation",
                    ],
                },
            },
        },
        "required": [
            "general_summary",
            "overall_risk_level",
            "main_exposed_weaknesses",
            "recommended_action",
            "tweet_reviews",
        ],
    },
    "strict": True,
}


async def get_or_create_ai_summary_for_query(query_id: str, current_user: dict):
    existing = await ai_query_summaries_collection.find_one({"query_id": query_id})

    if existing:
        return AIQuerySummaryInDB.from_mongo(existing)

    cursor = processed_collection.find({"query_id": query_id}).sort("fetched_at", -1)

    tweets = []

    async for doc in cursor:
        tweets.append(
            {
                "db_id": str(doc.get("_id")),
                "tweet_id": doc.get("tweet_id"),
                "content": doc.get("content"),
                "model_is_dangerous": doc.get("is_dangerous"),
                "model_category": doc.get("category"),
                "confidence": doc.get("confidence"),
                "username": doc.get("username"),
                "url": doc.get("url"),
            }
        )

    if not tweets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processed tweets found for this query_id",
        )

    if len(tweets) > 50:
        tweets = tweets[:50]

    prompt = f"""
You are reviewing tweets that were automatically classified by an ML model.

For each tweet:
1. Decide whether you agree with the model tagging.
2. Decide if the tweet is dangerous.
3. If dangerous, explain what weakness/exposure it reveals.
4. If you disagree with the model, explain why.
5. Keep explanations practical and short.

Important:
- Categories should stay close to: Oil, Electricity, Gas, Other.
- Dangerous means the tweet may expose sensitive infrastructure, location, operational weakness, damage, outage, vulnerability, or exploitable information.
- If the tweet is not dangerous, exposed_weakness should be null.

Tweets:
{json.dumps(tweets, ensure_ascii=False)}
"""

    response = client.responses.create(
        model="gpt-5.5",
        input=[
            {
                "role": "system",
                "content": "Return only valid JSON matching the provided schema.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": AI_SUMMARY_JSON_SCHEMA["name"],
                "schema": AI_SUMMARY_JSON_SCHEMA["schema"],
                "strict": True,
            }
        },
    )

    ai_data = json.loads(response.output_text)

    tweet_reviews = ai_data["tweet_reviews"]

    dangerous_count_by_ai = sum(
        1 for review in tweet_reviews if review["ai_is_dangerous"] is True
    )

    disagreements_count = sum(
        1 for review in tweet_reviews if review["ai_agrees_with_model"] is False
    )

    summary_doc = {
        "query_id": query_id,
        "requested_by": str(current_user["_id"]),
        "general_summary": ai_data["general_summary"],
        "overall_risk_level": ai_data["overall_risk_level"],
        "main_exposed_weaknesses": ai_data["main_exposed_weaknesses"],
        "recommended_action": ai_data["recommended_action"],
        "tweets_reviewed_count": len(tweet_reviews),
        "dangerous_count_by_ai": dangerous_count_by_ai,
        "disagreements_count": disagreements_count,
        "tweet_reviews": tweet_reviews,
        "created_at": datetime.now(timezone.utc),
    }

    result = await ai_query_summaries_collection.insert_one(summary_doc)
    summary_doc["_id"] = str(result.inserted_id)

    return AIQuerySummaryInDB(**summary_doc)