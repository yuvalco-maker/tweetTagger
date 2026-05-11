import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path


# --------------------------------------------------
# Load env
# --------------------------------------------------
env_path = Path(__file__).resolve().parent.parent.parent / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


# --------------------------------------------------
# Mongo connection
# --------------------------------------------------
client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = client.tweet_tag_database


# --------------------------------------------------
# Connection check
# --------------------------------------------------
async def connect_to_mongo():
    try:
        await client.admin.command("ping")
        print("✅ MongoDB connected successfully.")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise e


async def close_mongo_connection():
    print("Closing MongoDB connection...")
    client.close()


# --------------------------------------------------
# Collections (existing)
# --------------------------------------------------
tagged_collection = db.get_collection("processed")
untagged_collection = db.get_collection("untagged_tweets")
processed_collection = db.get_collection("processed_phase_II")
users_collection = db.get_collection("users_phase_II")
mock_collection = db.get_collection("working")


# --------------------------------------------------
# 🔐 Auth
# --------------------------------------------------
password_reset_tokens_collection = db.get_collection("password_reset_tokens")


# --------------------------------------------------
# 🔥 NEW - Tweets for model app
# --------------------------------------------------
tweets_collection = db.get_collection("tweets")


# --------------------------------------------------
# 🔥 NEW - Query history (very important)
# --------------------------------------------------
tweet_search_queries_collection = db.get_collection("tweet_search_queries")
# --------------------------------------------------
# 🤖 AI summaries per query
# --------------------------------------------------
ai_query_summaries_collection = db.get_collection("ai_query_summaries")
