from datetime import datetime, timezone
import math

from backend.app.db.database import (
    tweet_search_queries_collection,
    processed_collection,
    mab_arms_collection,
)
import json
import os
from openai import OpenAI
ARM_1_ID = "arm_1_historical_dangerous_queries"
ARM_1_NAME = "Historically Successful Dangerous Queries"

ARM_2_ID = "arm_2_infrastructure_keywords"
ARM_2_NAME = "Infrastructure Keyword Queries"

ARM_3_ID = "arm_3_location_hotspots"
ARM_3_NAME = "Location Hotspot Queries"
ARM_4_ID = "arm_4_ai_query_expansion"
ARM_4_NAME = "AI Query Expansion"
ARM_5_ID = "arm_5_recent_category_trends"
ARM_5_NAME = "Recent Category Trend Queries"

ALL_ARMS = [
    (ARM_1_ID, ARM_1_NAME),
    (ARM_2_ID, ARM_2_NAME),
    (ARM_3_ID, ARM_3_NAME),
    (ARM_4_ID, ARM_4_NAME),
    (ARM_5_ID, ARM_5_NAME),
]


CATEGORY_QUERY_TEMPLATES = {
    "Oil": [
        "oil infrastructure attack",
        "oil refinery explosion",
        "fuel depot fire",
    ],
    "Gas": [
        "gas pipeline attack",
        "natural gas facility explosion",
        "gas infrastructure strike",
    ],
    "Electricity": [
        "power outage",
        "electric grid attack",
        "power plant strike",
    ],
    "Other": [
        "critical infrastructure attack",
        "security incident infrastructure",
        "strategic facility strike",
    ],
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

INFRASTRUCTURE_KEYWORDS = [
    "bazan",
    "haifa refinery",
    "oil refinery",
    "oil refineries",
    "refinery",
    "petrochemical",
    "pipeline",
    "oil pipeline",
    "gas pipeline",
    "fuel depot",
    "fuel storage",
    "power plant",
    "electric grid",
    "substation",
    "haifa port",
    "ashdod port",
    "lng terminal",
    "natural gas",
    "dimona",
]


async def ensure_mab_arm_exists(arm_id: str, arm_name: str):
    await mab_arms_collection.update_one(
        {"arm_id": arm_id},
        {
            "$setOnInsert": {
                "arm_id": arm_id,
                "arm_name": arm_name,
                "runs": 0,
                "total_reward": 0.0,
                "avg_reward": 0.0,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


def calculate_success_rate(query: dict) -> float:
    dangerous_count = query.get("dangerous_count") or 0
    ml_processed_count = query.get("ml_processed_count") or 0

    if ml_processed_count == 0:
        return 0.0

    return round(dangerous_count / ml_processed_count, 4)


async def get_historically_successful_dangerous_queries(limit: int = 5):
    await ensure_mab_arm_exists(ARM_1_ID, ARM_1_NAME)

    cursor = tweet_search_queries_collection.find(
        {
            "ml_processed_count": {"$gt": 0},
            "dangerous_count": {"$gt": 0},
            "status": "completed",
        }
    )

    recommendations = []

    async for query in cursor:
        success_rate = calculate_success_rate(query)

        recommendations.append(
            {
                "query_id": str(query["_id"]),
                "keywords": query.get("keywords") or [],
                "start_date": query.get("start_date"),
                "end_date": query.get("end_date"),
                "arm_id": ARM_1_ID,
                "arm_name": ARM_1_NAME,
                "score": success_rate,
                "source": "historical_success",
                "metadata": {
                    "success_rate": success_rate,
                    "dangerous_count": query.get("dangerous_count") or 0,
                    "ml_processed_count": query.get("ml_processed_count") or 0,
                    "dangerous_percentage": query.get("dangerous_percentage") or 0,
                    "language": query.get("language"),
                    "max_items": query.get("max_items"),
                },
                "reason": (
                    "This query is recommended because historically it returned "
                    "a high ratio of dangerous tweets."
                ),
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["score"],
            item["metadata"]["dangerous_count"],
            item["metadata"]["ml_processed_count"],
        ),
        reverse=True,
    )

    return {
        "arm_id": ARM_1_ID,
        "arm_name": ARM_1_NAME,
        "recommendations": recommendations[:limit],
    }


async def get_infrastructure_keyword_queries(limit: int = 5):
    await ensure_mab_arm_exists(ARM_2_ID, ARM_2_NAME)

    recommendations = []

    for keyword in INFRASTRUCTURE_KEYWORDS[:limit]:
        recommendations.append(
            {
                "query_id": None,
                "keywords": [keyword],
                "start_date": None,
                "end_date": None,
                "arm_id": ARM_2_ID,
                "arm_name": ARM_2_NAME,
                "score": 0.5,
                "source": "infrastructure_keywords",
                "metadata": {
                    "keyword": keyword,
                },
                "reason": (
                    "This query is recommended because it contains "
                    "critical infrastructure or geopolitical threat keywords."
                ),
            }
        )

    return {
        "arm_id": ARM_2_ID,
        "arm_name": ARM_2_NAME,
        "recommendations": recommendations,
    }


async def get_location_hotspot_queries(limit: int = 5):
    await ensure_mab_arm_exists(ARM_3_ID, ARM_3_NAME)

    cursor = processed_collection.find(
        {
            "is_dangerous": True,
            "coordinates": {"$exists": True, "$ne": None},
        },
        {
            "coordinates": 1,
            "category": 1,
        },
    )

    location_stats = {}

    async for tweet in cursor:
        coordinates = tweet.get("coordinates") or []

        if not isinstance(coordinates, list):
            continue

        for location in coordinates:
            if not isinstance(location, dict):
                continue

            place_name = location.get("place_name")
            if not place_name:
                continue

            key = place_name.strip().lower()
            if not key:
                continue

            if key not in location_stats:
                location_stats[key] = {
                    "place_name": place_name,
                    "count": 0,
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                    "confidence": location.get("confidence"),
                    "categories": {},
                }

            location_stats[key]["count"] += 1

            category = tweet.get("category") or "Unknown"
            location_stats[key]["categories"][category] = (
                location_stats[key]["categories"].get(category, 0) + 1
            )

    sorted_locations = sorted(
        location_stats.values(),
        key=lambda item: item["count"],
        reverse=True,
    )

    max_count = sorted_locations[0]["count"] if sorted_locations else 1
    recommendations = []

    for location in sorted_locations[:limit]:
        place_name = location["place_name"]
        score = round(location["count"] / max_count, 4)

        recommendations.append(
            {
                "query_id": None,
                "keywords": [place_name],
                "start_date": None,
                "end_date": None,
                "arm_id": ARM_3_ID,
                "arm_name": ARM_3_NAME,
                "score": score,
                "source": "location_hotspot",
                "metadata": {
                    "place_name": place_name,
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                    "confidence": location.get("confidence"),
                    "hotspot_count": location["count"],
                    "categories": location.get("categories", {}),
                },
                "reason": (
                    "This query is recommended because this location appeared "
                    "frequently in dangerous tweets with extracted coordinates."
                ),
            }
        )

    return {
        "arm_id": ARM_3_ID,
        "arm_name": ARM_3_NAME,
        "recommendations": recommendations,
    }
async def get_ai_generated_queries(
    seed_topic: str,
    limit: int = 5,
):
    await ensure_mab_arm_exists(ARM_4_ID, ARM_4_NAME)

    prompt = f"""
You are a geopolitical threat intelligence query generator.

Generate concise Twitter/X search queries related to:
{seed_topic}

Rules:
- Return ONLY valid JSON
- Return an array of strings
- No markdown
- No explanations
- Maximum {limit} queries
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You generate geopolitical threat-search queries."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.8,
    )

    content = response.choices[0].message.content

    try:
        generated_queries = json.loads(content)

        if not isinstance(generated_queries, list):
            generated_queries = []

    except Exception:
        generated_queries = []

    recommendations = []

    for query in generated_queries[:limit]:
        if not isinstance(query, str):
            continue

        query = query.strip()

        if not query:
            continue

        recommendations.append(
            {
                "query_id": None,
                "keywords": [query],
                "start_date": None,
                "end_date": None,
                "arm_id": ARM_4_ID,
                "arm_name": ARM_4_NAME,
                "score": 0.5,
                "source": "ai_generated",
                "metadata": {
                    "seed_topic": seed_topic,
                    "generation_method": "openai",
                },
                "reason": (
                    "This query was generated using AI-based "
                    "query expansion."
                ),
            }
        )

    return {
        "arm_id": ARM_4_ID,
        "arm_name": ARM_4_NAME,
        "recommendations": recommendations,
    }
async def get_recent_category_trend_queries(limit: int = 5):
    await ensure_mab_arm_exists(ARM_5_ID, ARM_5_NAME)

    cursor = processed_collection.find(
        {
            "is_dangerous": True,
            "category": {"$exists": True, "$ne": None},
        },
        {
            "category": 1,
        },
    )

    category_counts = {}

    async for tweet in cursor:
        category = tweet.get("category") or "Other"
        category_counts[category] = category_counts.get(category, 0) + 1

    sorted_categories = sorted(
        category_counts.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    if not sorted_categories:
        return {
            "arm_id": ARM_5_ID,
            "arm_name": ARM_5_NAME,
            "recommendations": [],
        }

    max_count = sorted_categories[0][1]
    recommendations = []

    for category, count in sorted_categories:
        templates = CATEGORY_QUERY_TEMPLATES.get(
            category,
            CATEGORY_QUERY_TEMPLATES["Other"],
        )

        for query_text in templates:
            if len(recommendations) >= limit:
                break

            score = round(count / max_count, 4)

            recommendations.append(
                {
                    "query_id": None,
                    "keywords": [query_text],
                    "start_date": None,
                    "end_date": None,
                    "arm_id": ARM_5_ID,
                    "arm_name": ARM_5_NAME,
                    "score": score,
                    "source": "recent_category_trends",
                    "metadata": {
                        "category": category,
                        "dangerous_count": count,
                    },
                    "reason": (
                        "This query is recommended because this category "
                        "recently appeared frequently in dangerous tweets."
                    ),
                }
            )

        if len(recommendations) >= limit:
            break

    return {
        "arm_id": ARM_5_ID,
        "arm_name": ARM_5_NAME,
        "recommendations": recommendations,
    }


async def _fetch_all_arm_records() -> dict:
    for arm_id, arm_name in ALL_ARMS:
        await ensure_mab_arm_exists(arm_id, arm_name)

    cursor = mab_arms_collection.find(
        {"arm_id": {"$in": [a[0] for a in ALL_ARMS]}}
    )
    return {arm["arm_id"]: arm async for arm in cursor}


def _ucb1_score(avg_reward: float, runs: int, total_runs: int) -> float:
    if runs == 0 or total_runs == 0:
        return float("inf")
    return avg_reward + math.sqrt(2 * math.log(total_runs) / runs)


async def get_ucb1_scores() -> list:
    arms = await _fetch_all_arm_records()
    total_runs = sum(a.get("runs", 0) for a in arms.values())

    result = []
    for arm_id, arm_name in ALL_ARMS:
        arm = arms.get(arm_id, {})
        runs = arm.get("runs", 0)
        avg_reward = arm.get("avg_reward", 0.0)
        score = _ucb1_score(avg_reward, runs, total_runs)
        result.append(
            {
                "arm_id": arm_id,
                "arm_name": arm_name,
                "runs": runs,
                "avg_reward": avg_reward,
                "ucb1_score": None if score == float("inf") else round(score, 6),
                "total_runs": total_runs,
            }
        )

    return result


async def select_arm_ucb1() -> dict:
    arms = await _fetch_all_arm_records()
    total_runs = sum(a.get("runs", 0) for a in arms.values())

    best_arm_id = None
    best_arm_name = None
    best_score = -1.0
    best_runs = 0
    best_avg = 0.0

    for arm_id, arm_name in ALL_ARMS:
        arm = arms.get(arm_id, {})
        runs = arm.get("runs", 0)
        avg_reward = arm.get("avg_reward", 0.0)
        score = _ucb1_score(avg_reward, runs, total_runs)

        if best_arm_id is None or score > best_score:
            best_score = score
            best_arm_id = arm_id
            best_arm_name = arm_name
            best_runs = runs
            best_avg = avg_reward

    return {
        "arm_id": best_arm_id,
        "arm_name": best_arm_name,
        "runs": best_runs,
        "avg_reward": best_avg,
        "ucb1_score": None if best_score == float("inf") else round(best_score, 6),
        "total_runs": total_runs,
    }


async def record_arm_reward(arm_id: str, reward: float) -> dict:
    arm = await mab_arms_collection.find_one({"arm_id": arm_id})
    if not arm:
        raise ValueError(f"Arm '{arm_id}' not found")

    runs = arm.get("runs", 0) + 1
    total_reward = arm.get("total_reward", 0.0) + reward
    avg_reward = total_reward / runs

    await mab_arms_collection.update_one(
        {"arm_id": arm_id},
        {
            "$set": {
                "runs": runs,
                "total_reward": round(total_reward, 6),
                "avg_reward": round(avg_reward, 6),
                "last_updated": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "arm_id": arm_id,
        "runs": runs,
        "total_reward": round(total_reward, 6),
        "avg_reward": round(avg_reward, 6),
    }