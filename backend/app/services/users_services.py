import os
from datetime import datetime, timezone

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from passlib.context import CryptContext

from backend.app.db.database import (
    users_collection,
    password_reset_tokens_collection,
    processed_collection,
    tweet_search_queries_collection,
)
from backend.app.schemas.user_schema import (
    UserResponse,
    createDefaultUser,
    createGoogleUser,
)
from backend.app.services.email_service import send_reset_link
from backend.app.services.jwt_service import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
)

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def is_admin(user_id: str) -> bool:
    try:
        oid = ObjectId(str(user_id))
    except Exception:
        return False

    user = await users_collection.find_one({"_id": oid})

    if not user:
        return False

    return bool(user.get("isADMIN", False))


async def get_user_by_id(user_id: str) -> str | None:
    try:
        oid = ObjectId(str(user_id))
    except Exception:
        return None

    user = await users_collection.find_one({"_id": oid}, {"username": 1})

    if not user:
        return None

    return user.get("username")


async def get_user_by_username(username: str):
    return await users_collection.find_one({"username": username})


async def register_user_def(user_in: createDefaultUser):
    existing_user = await users_collection.find_one(
        {"$or": [{"username": user_in.username}, {"email": user_in.email}]}
    )

    if existing_user:
        raise ValueError("User already exists")

    is_first = await users_collection.count_documents({}) == 0

    user_dict = {
        "username": user_in.username,
        "email": user_in.email,
        "password": hash_password(user_in.password),
        "isADMIN": is_first,
        "provider": "local",
    }

    result = await users_collection.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)

    return UserResponse(**user_dict)


async def login_user(username: str, password: str):
    user = await users_collection.find_one({"username": username})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    stored_password = user.get("password")

    if not stored_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google sign-in. Please continue with Google.",
        )

    if not verify_password(password, stored_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(
        {
            "sub": str(user["_id"]),
            "username": user["username"],
            "type": "access",
            "isADMIN": bool(user.get("isADMIN", False)),
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "isADMIN": bool(user.get("isADMIN", False)),
    }


async def continue_with_google(user_in: createGoogleUser):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID not configured",
        )

    try:
        id_info = id_token.verify_oauth2_token(
            user_in.token,
            requests.Request(),
            GOOGLE_CLIENT_ID,
        )

        google_id = id_info["sub"]
        email = id_info["email"]
        name = id_info.get("name", email.split("@")[0])
        profile_pic = id_info.get("picture")

        user = await users_collection.find_one({"google_id": google_id})

        if not user:
            user = await users_collection.find_one({"email": email})

            if user:
                await users_collection.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "google_id": google_id,
                            "provider": "google",
                            "profile_pic": profile_pic,
                        }
                    },
                )
                user = await users_collection.find_one({"_id": user["_id"]})

            else:
                is_first = await users_collection.count_documents({}) == 0
                new_user = {
                    "google_id": google_id,
                    "email": email,
                    "username": name,
                    "provider": "google",
                    "profile_pic": profile_pic,
                    "password": None,
                    "isADMIN": is_first,
                }

                result = await users_collection.insert_one(new_user)
                user = await users_collection.find_one({"_id": result.inserted_id})

        access_token = create_access_token(
            {
                "sub": str(user["_id"]),
                "username": user["username"],
                "type": "access",
                "isADMIN": bool(user.get("isADMIN", False)),
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "isADMIN": bool(user.get("isADMIN", False)),
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )


async def forgot_password(email: str):
    generic_message = {
        "message": "If an account with that email exists, a reset link has been sent."
    }

    user = await users_collection.find_one({"email": email})

    if not user:
        return generic_message

    # Google users have password=None, so they should keep using Google login.
    if not user.get("password"):
        return generic_message

    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)

    await password_reset_tokens_collection.update_many(
        {"user_id": user_id, "used": False},
        {
            "$set": {
                "used": True,
                "used_at": now,
            }
        },
    )

    token, jti = create_password_reset_token(user_id)
    payload = decode_password_reset_token(token)

    reset_doc = {
        "user_id": user_id,
        "token_jti": jti,
        "expires_at": datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        "used": False,
        "created_at": now,
        "used_at": None,
    }

    await password_reset_tokens_collection.insert_one(reset_doc)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    email_result = await send_reset_link(email, reset_link)

    if email_result != "success":
        raise ValueError(f"Failed to send reset email: {email_result}")

    return generic_message


async def reset_password(token: str, new_password: str):
    payload = decode_password_reset_token(token)

    user_id = payload["sub"]
    jti = payload["jti"]

    reset_record = await password_reset_tokens_collection.find_one(
        {
            "user_id": user_id,
            "token_jti": jti,
            "used": False,
        }
    )

    if not reset_record:
        raise ValueError("Invalid or already used reset token")

    now = datetime.now(timezone.utc)

    expires_at = reset_record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise ValueError("Reset token has expired")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user id in token")

    user = await users_collection.find_one({"_id": oid})

    if not user:
        raise ValueError("User not found")

    if not user.get("password"):
        raise ValueError("This account uses Google sign-in. Please continue with Google.")

    new_hashed_password = hash_password(new_password)

    await users_collection.update_one(
        {"_id": oid},
        {"$set": {"password": new_hashed_password}},
    )

    await password_reset_tokens_collection.update_one(
        {"_id": reset_record["_id"]},
        {
            "$set": {
                "used": True,
                "used_at": now,
            }
        },
    )

    return {"message": "Password has been reset successfully"}


async def get_user_activity(username: str):
    user = await users_collection.find_one({"username": username})
    if not user:
        raise ValueError("User not found")

    user_id = str(user["_id"])

    # Queries
    queries = []
    total_fetched = 0
    async for doc in tweet_search_queries_collection.find(
        {"requested_by": user_id}
    ).sort("requested_at", -1).limit(100):
        doc["_id"] = str(doc["_id"])
        doc.pop("embedding_vector", None)
        total_fetched += doc.get("inserted_count", 0)
        queries.append(doc)

    # Edited tweets
    edited_tweets = []
    async for doc in processed_collection.find(
        {"tagged_by": user_id, "edited": True}
    ).sort("fetched_at", -1).limit(200):
        doc["_id"] = str(doc["_id"])
        edited_tweets.append(doc)

    return {
        "user": {
            "user_id": user_id,
            "username": user.get("username"),
            "email": user.get("email"),
            "isADMIN": bool(user.get("isADMIN", False)),
        },
        "stats": {
            "total_queries": len(queries),
            "total_fetched": total_fetched,
            "total_edits": len(edited_tweets),
        },
        "queries": queries,
        "edited_tweets": edited_tweets,
    }


async def get_my_activity(user_id: str):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user id")

    user = await users_collection.find_one({"_id": oid})
    if not user:
        raise ValueError("User not found")

    queries = []
    total_fetched = 0
    async for doc in tweet_search_queries_collection.find(
        {"requested_by": user_id}
    ).sort("requested_at", -1).limit(100):
        doc["_id"] = str(doc["_id"])
        doc.pop("embedding_vector", None)
        total_fetched += doc.get("inserted_count", 0)
        queries.append(doc)

    edited_tweets = []
    async for doc in processed_collection.find(
        {"tagged_by": user_id, "edited": True}
    ).sort("fetched_at", -1).limit(200):
        doc["_id"] = str(doc["_id"])
        edited_tweets.append(doc)

    return {
        "user": {
            "user_id": user_id,
            "username": user.get("username"),
            "email": user.get("email"),
            "isADMIN": bool(user.get("isADMIN", False)),
        },
        "stats": {
            "total_queries": len(queries),
            "total_fetched": total_fetched,
            "total_edits": len(edited_tweets),
        },
        "queries": queries,
        "edited_tweets": edited_tweets,
    }


async def search_users_by_query(q: str, limit: int = 8):
    q = q.strip()
    if not q:
        return []
    cursor = users_collection.find(
        {"username": {"$regex": q, "$options": "i"}},
        {"username": 1}
    ).limit(limit)
    results = []
    async for doc in cursor:
        name = doc.get("username")
        if name:
            results.append(name)
    return results


async def get_all_users():
    cursor = users_collection.find({}, {"password": 0})
    users = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        users.append(doc)
    return users


async def promote_user(user_id: str, current_user: dict):
    if not current_user.get("isADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id")

    user = await users_collection.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await users_collection.update_one({"_id": oid}, {"$set": {"isADMIN": True}})
    return {"message": f"{user['username']} promoted to admin"}