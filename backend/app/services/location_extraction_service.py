import os
import json
import asyncio

from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

LOCATION_JSON_SCHEMA = {
    "name": "tweet_location_extraction",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "locations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "place_name": {"type": "string"},
                        "lat": {"type": "number"},
                        "lng": {"type": "number"},
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                        },
                    },
                    "required": ["place_name", "lat", "lng", "confidence"],
                },
            }
        },
        "required": ["locations"],
    },
    "strict": True,
}


def _extract_sync(tweet_text: str) -> list[dict]:
    prompt = f"""You are a geopolitical threat-location extraction system.

Given a tweet, identify the real-world locations the tweet refers to.

Return JSON with a "locations" array.

Rules:
- If the tweet does not describe a physical location, return an empty locations array
- If confidence is low, return an empty locations array
- If multiple locations are mentioned, return all of them
- Each object must contain: place_name, lat, lng, confidence

Tweet:
"{tweet_text}"
"""

    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=[
            {"role": "system", "content": "Return only JSON matching the provided schema."},
            {"role": "user", "content": prompt},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": LOCATION_JSON_SCHEMA["name"],
                "schema": LOCATION_JSON_SCHEMA["schema"],
                "strict": True,
            }
        },
    )

    data = json.loads(response.output_text)
    return data.get("locations", [])


async def extract_locations_from_tweet(tweet_text: str) -> list[dict]:
    return await asyncio.to_thread(_extract_sync, tweet_text)
