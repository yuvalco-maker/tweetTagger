from pulp import LpProblem, LpMinimize, LpVariable, lpSum, LpStatus, value

from backend.app.db.database import processed_collection

MAX_CANDIDATES_RATIO = 1 / 3
CONFIDENCE_THRESHOLD = 0.75
NO_REVIEW_UNCERTAINTY_THRESHOLD = 0.30  # avg uncertainty of top candidates to trigger review


def _uncertainty(tweet: dict) -> float:
    """1 - confidence, clamped to [0, 1]."""
    return round(1.0 - float(tweet.get("confidence") or 0.5), 4)


def _review_reason(tweet: dict, is_mandatory: bool) -> str:
    if is_mandatory:
        return "danger model flagged as dangerous (low precision model — needs human verification)"
    cat = tweet.get("category", "")
    if cat in ("Electricity", "Gas"):
        return f"category '{cat}' is underrepresented in training data"
    return f"model uncertainty {_uncertainty(tweet):.0%}"


async def get_review_queue(query_id: str) -> dict:
    cursor = processed_collection.find({"query_id": query_id})
    tweets = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        tweets.append(doc)

    if not tweets:
        return {"no_review": True, "reason": "No processed tweets found for this query.", "queue": []}

    max_candidates = max(1, int(len(tweets) * MAX_CANDIDATES_RATIO))

    dangerous = [t for t in tweets if t.get("is_dangerous") is True]
    safe = [t for t in tweets if t.get("is_dangerous") is not True]

    # Sort safe tweets by uncertainty descending
    safe_sorted = sorted(safe, key=_uncertainty, reverse=True)

    # Build candidate pool
    candidates = list(dangerous)
    remaining_slots = max_candidates - len(candidates)
    if remaining_slots > 0:
        candidates += safe_sorted[:remaining_slots]

    # No review check: zero dangerous AND top candidates not uncertain enough
    if not dangerous:
        top = safe_sorted[:max_candidates]
        if top:
            avg_uncertainty = sum(_uncertainty(t) for t in top) / len(top)
            if avg_uncertainty < NO_REVIEW_UNCERTAINTY_THRESHOLD:
                return {
                    "no_review": True,
                    "reason": "Model is confident about all tweets in this query — no review needed.",
                    "queue": [],
                }

    if not candidates:
        return {"no_review": True, "reason": "No review candidates found.", "queue": []}

    n = len(candidates)

    categories = list({t.get("category") for t in candidates if t.get("category")})

    # --- LP ---
    prob = LpProblem("review_queue", LpMinimize)
    x = [LpVariable(f"x_{i}", cat="Binary") for i in range(n)]

    # Objective: minimize number of tweets selected
    prob += lpSum(x)

    # Category coverage: at least one tweet per category present in candidates
    for cat in categories:
        indices = [i for i, t in enumerate(candidates) if t.get("category") == cat]
        if indices:
            prob += lpSum(x[i] for i in indices) >= 1

    # All dangerous tweets must be included
    for i, t in enumerate(candidates):
        if t.get("is_dangerous") is True:
            prob += x[i] == 1

    prob.solve()

    if LpStatus[prob.status] != "Optimal":
        # Fallback: return all candidates if LP can't solve
        selected = candidates
    else:
        selected = [candidates[i] for i in range(n) if value(x[i]) == 1]

    queue = [
        {
            "_id": t["_id"],
            "tweet_id": t.get("tweet_id"),
            "content": t.get("content"),
            "category": t.get("category"),
            "is_dangerous": t.get("is_dangerous"),
            "confidence": t.get("confidence"),
            "uncertainty": _uncertainty(t),
            "reason": _review_reason(t, t.get("is_dangerous") is True),
        }
        for t in selected
    ]

    return {"no_review": False, "reason": None, "queue": queue}
