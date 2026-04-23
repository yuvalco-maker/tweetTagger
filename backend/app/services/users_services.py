import os

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from passlib.context import CryptContext

from backend.app.db.database import users_collection
from backend.app.schemas.user_schema import (
    UserResponse,
    createDefaultUser,
    createGoogleUser,
)
from backend.app.services.jwt_service import create_access_token

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

    user_dict = {
        "username": user_in.username,
        "email": user_in.email,
        "password": hash_password(user_in.password),
        "isADMIN": False,
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
                new_user = {
                    "google_id": google_id,
                    "email": email,
                    "username": name,
                    "provider": "google",
                    "profile_pic": profile_pic,
                    "password": None,
                    "isADMIN": False,
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