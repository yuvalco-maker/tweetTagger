import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from collections import defaultdict
from bson import ObjectId

MONGO_URI = "mongodb+srv://yuvalco:QxLprn8FnonRfdDX@cluster0.vquudw5.mongodb.net/"

client = AsyncIOMotorClient(MONGO_URI)
db = client.tweet_tag_database

users_col = db.get_collection("users_phase_II")
processed_col = db.get_collection("processed_phase_II")
queries_col = db.get_collection("tweet_search_queries")


async def main():
    # Build user map: id -> username
    user_map = {}
    async for u in users_col.find({}, {"_id": 1, "username": 1, "email": 1}):
        user_map[str(u["_id"])] = u.get("username") or u.get("email", "?")

    # Edits per user (tagged_by exists and edited=True)
    edits_by_user = defaultdict(int)
    async for doc in processed_col.find({"tagged_by": {"$exists": True, "$ne": None}}):
        uid = str(doc["tagged_by"])
        if doc.get("edited"):
            edits_by_user[uid] += 1

    # All tagging actions per user (edited or not)
    tags_by_user = defaultdict(int)
    async for doc in processed_col.find({"tagged_by": {"$exists": True, "$ne": None}}):
        uid = str(doc["tagged_by"])
        tags_by_user[uid] += 1

    # Queries per user
    queries_by_user = defaultdict(int)
    async for doc in queries_col.find({}):
        uid = str(doc.get("requested_by", ""))
        if uid:
            queries_by_user[uid] += 1

    # Collect all user ids seen
    all_uids = set(list(user_map.keys()) + list(edits_by_user.keys()) + list(tags_by_user.keys()) + list(queries_by_user.keys()))

    print(f"\n{'User':<25} {'Tags (total)':<15} {'Edits':<10} {'Queries':<10}")
    print("-" * 65)
    for uid in sorted(all_uids, key=lambda u: queries_by_user[u] + tags_by_user[u], reverse=True):
        name = user_map.get(uid, f"(unknown:{uid[:8]})")
        tags = tags_by_user[uid]
        edits = edits_by_user[uid]
        queries = queries_by_user[uid]
        print(f"{name:<25} {tags:<15} {edits:<10} {queries:<10}")

    print(f"\nTotal users: {len(user_map)}")
    print(f"Total tags: {sum(tags_by_user.values())}")
    print(f"Total edits: {sum(edits_by_user.values())}")
    print(f"Total queries: {sum(queries_by_user.values())}")


asyncio.run(main())
