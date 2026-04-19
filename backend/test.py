import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def test_connection():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    try:
        # The 'ping' command is cheap and tells us if the server is alive
        await client.admin.command('ping')
        print("✅ Connection Successful! Atlas is talking back.")
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_connection())