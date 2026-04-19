import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path


env_path = Path(__file__).resolve().parent.parent.parent / ".env"

if env_path.exists():
    # Local: Use the file on your machine
    load_dotenv(dotenv_path=env_path)
else:
    # AWS: Use the variables you typed into the App Runner Console
    load_dotenv()
# the connection object
client = AsyncIOMotorClient(os.getenv("MONGO_URI"))

# db refers to the spacific database in the cluster
db = client.tweet_tag_database


# uses ping to make sure the client was created seccessfully
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


tagged_collection = db.get_collection("learning_data")
untagged_collection = db.get_collection("untagged_tweets")
processed_collection = db.get_collection("processed_phase_II")
users_collection = db.get_collection("users_phase_II")

password_reset_tokens_collection = db.get_collection("reset_password_tokens")
