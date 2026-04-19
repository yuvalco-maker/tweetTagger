from fastapi import APIRouter, FastAPI
from contextlib import asynccontextmanager
from .db.database import connect_to_mongo, close_mongo_connection

from dotenv import load_dotenv
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db.database import (
    tagged_collection,
    processed_collection,
    users_collection,
    untagged_collection,
    password_reset_tokens_collection,
)

import asyncio

from backend.app.controller.users_controller import router as registration_router


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await connect_to_mongo()
        print("MongoDB connected successfully.")

    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        raise e
    finally:
        yield
        await close_mongo_connection()
        print("MongoDB connection closed.")


# the server object
app = FastAPI(
    title="Tweet Tagger",
    description="a server the uses ML  to tag tweets",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # In development, this allows any frontend to connect
    allow_methods=["*"],
    allow_headers=["*"],
)
#############################
# route linking down here #
#############################
# app/controllers/auth_controller.py
app.include_router(registration_router)


@app.get("/health")
async def health():
    return {"status": "alive", "database": "connected"}
