from datetime import datetime, timezone
from typing import Optional

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import PCA

from backend.app.db.database import processed_collection
from backend.app.services.embedding_service import (
    create_text_embedding,
    OPENAI_EMBEDDING_MODEL,
)


def normalize_vectors(vectors: list[list[float]]) -> np.ndarray:
    matrix = np.array(vectors, dtype=float)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return matrix / norms


def safe_datetime(value):
    if not value:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def build_points_2d(vectors: np.ndarray) -> np.ndarray:
    if len(vectors) < 2:
        return np.array([[0.0, 0.0]])

    return PCA(n_components=2).fit_transform(vectors)


async def ensure_tweet_embedding(tweet: dict):
    if tweet.get("embedding_vector"):
        return tweet["embedding_vector"]

    content = " ".join((tweet.get("content") or "").split())[:4000]

    if not content:
        return None

    embedding_vector = await create_text_embedding(content)

    if not embedding_vector:
        return None

    await processed_collection.update_one(
        {"_id": tweet["_id"]},
        {
            "$set": {
                "embedding_text": content,
                "embedding_vector": embedding_vector,
                "embedding_model": OPENAI_EMBEDDING_MODEL,
            }
        },
    )

    return embedding_vector


async def cluster_dangerous_tweets_by_category(
    category: str,
    limit: int = 200,
    min_cluster_size: int = 5,
    min_samples: Optional[int] = 2,
):
    cursor = (
        processed_collection.find(
            {
                "is_dangerous": True,
                "category": category,
            }
        )
        .sort("tagged_at", -1)
        .limit(limit)
    )

    tweets = []

    async for tweet in cursor:
        tweets.append(tweet)

    if len(tweets) < min_cluster_size:
        return {
            "category": category,
            "algorithm": "hdbscan",
            "total_tweets": len(tweets),
            "embedded_tweets": 0,
            "min_cluster_size": min_cluster_size,
            "min_samples": min_samples,
            "message": "Not enough dangerous tweets in this category for HDBSCAN clustering.",
            "clusters": [],
            "points": [],
        }

    usable_tweets = []
    vectors = []

    for tweet in tweets:
        vector = await ensure_tweet_embedding(tweet)

        if vector:
            usable_tweets.append(tweet)
            vectors.append(vector)

    if len(usable_tweets) < min_cluster_size:
        return {
            "category": category,
            "algorithm": "hdbscan",
            "total_tweets": len(tweets),
            "embedded_tweets": len(usable_tweets),
            "min_cluster_size": min_cluster_size,
            "min_samples": min_samples,
            "message": "Not enough tweets with embeddings for clustering.",
            "clusters": [],
            "points": [],
        }

    normalized_vectors = normalize_vectors(vectors)

    # HDBSCAN runs on the full normalized embedding space.
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
    )

    labels = clusterer.fit_predict(normalized_vectors)

    # PCA is only for visualization after clustering.
    points_2d = build_points_2d(normalized_vectors)

    clustered_at = datetime.now(timezone.utc)
    clusters_map = {}
    points = []

    for tweet, cluster_id, point in zip(usable_tweets, labels, points_2d):
        cluster_id = int(cluster_id)

        await processed_collection.update_one(
            {"_id": tweet["_id"]},
            {
                "$set": {
                    "cluster_id": cluster_id,
                    "cluster_category": category,
                    "cluster_algorithm": "hdbscan",
                    "clustered_at": clustered_at,
                    "cluster_x": float(point[0]),
                    "cluster_y": float(point[1]),
                }
            },
        )

        tweet_payload = {
            "_id": str(tweet["_id"]),
            "tweet_id": tweet.get("tweet_id"),
            "content": tweet.get("content"),
            "url": tweet.get("url"),
            "username": tweet.get("username"),
            "created_at": safe_datetime(tweet.get("created_at")),
            "category": tweet.get("category"),
            "is_dangerous": tweet.get("is_dangerous"),
            "cluster_id": cluster_id,
            "x": float(point[0]),
            "y": float(point[1]),
        }

        clusters_map.setdefault(cluster_id, []).append(tweet_payload)
        points.append(tweet_payload)

    clusters = []

    for cluster_id, cluster_tweets in clusters_map.items():
        clusters.append(
            {
                "cluster_id": cluster_id,
                "label": "Noise" if cluster_id == -1 else f"Threat theme {cluster_id}",
                "count": len(cluster_tweets),
                "tweets": cluster_tweets,
            }
        )

    clusters.sort(key=lambda item: (item["cluster_id"] == -1, -item["count"]))

    return {
        "category": category,
        "algorithm": "hdbscan",
        "total_tweets": len(tweets),
        "embedded_tweets": len(usable_tweets),
        "min_cluster_size": min_cluster_size,
        "min_samples": min_samples,
        "clustered_at": clustered_at.isoformat(),
        "clusters": clusters,
        "points": points,
    }