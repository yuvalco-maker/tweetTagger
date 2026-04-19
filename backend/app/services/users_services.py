from bson import ObjectId
from backend.app.db.database import users_collection
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

from passlib.context import CryptContext

from backend.app.db.database import users_collection, password_reset_tokens_collection
from backend.app.schemas.user_schema import (
    UserResponse,
    createDefaultUser,
    createGoogleUser,
)
from google.oauth2 import id_token
from google.auth.transport import requests
from fastapi import HTTPException

load_dotenv()


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")


if not GOOGLE_CLIENT_ID:
    raise ValueError("GOOGLE_CLIENT_ID not found in .env file!")


async def is_admin(user_id: str) -> bool:
    """
    Returns True only if user exists AND isADMIN == True
    """

    try:
        oid = ObjectId(str(user_id))
    except Exception:
        return False

    user = await users_collection.find_one({"_id": oid})

    if not user:
        return False

    return bool(user.get("isADMIN", False))


async def get_user_by_id(user_id: str) -> str | None:
    """
    Returns username string or None.
    """

    try:
        oid = ObjectId(str(user_id))
    except Exception:
        return None

    user = await users_collection.find_one({"_id": oid}, {"username": 1})

    if not user:
        return None

    return user.get("username")


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def register_user_def(user_in: createDefaultUser):

    existing_user = await users_collection.find_one(
        {"$or": [{"username": user_in.username}, {"email": user_in.email}]}
    )
    if existing_user:
        raise ValueError("User already exists")

    user_dict = {
        "username": user_in.username,
        "email": user_in.email,
        "password": hash_password(user_in.email),
        "isADMIN": False,
    }

    result = await users_collection.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)

    return UserResponse(**user_dict)


async def continue_with_google(user_in: createGoogleUser):
    try:
        # 1. Verify the Google Token
        id_info = id_token.verify_oauth2_token(
            user_in.token, requests.Request(), GOOGLE_CLIENT_ID
        )

        google_id = id_info["sub"]
        email = id_info["email"]
        name = id_info.get("name", email.split("@")[0])  # Fallback if name is missing

        # 2. Check MongoDB
        user = await users_collection.find_one({"google_id": google_id})

        if not user:
            # 3. Create new user
            user = await users_collection.find_one({"email": email})
            if user:
                await users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"google_id": google_id, "provider": "google"}},
                )
                return {
                    "status": "logged_in_and_linked",
                    "email": email,
                    "username": name,
                    "user_id": str(user["_id"]),
                }
            new_user = {
                "google_id": google_id,
                "email": email,
                "username": name,
                "provider": "google",
            }

            result = await users_collection.insert_one(new_user)

            return {
                "status": "created",
                "email": email,
                "username": name,
                "user_id": str(result.inserted_id),
            }

        return {
            "status": "logging_in",
            "email": user["email"],
            "username": user["username"],
            "user_id": str(user["_id"]),
        }

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google token",
        )
