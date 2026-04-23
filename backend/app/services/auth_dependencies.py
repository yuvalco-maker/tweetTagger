from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from bson import ObjectId

from backend.app.services.jwt_service import decode_access_token
from backend.app.db.database import users_collection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id or token_type != "access":
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # convert to ObjectId
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise credentials_exception

    user = await users_collection.find_one({"_id": oid})

    if not user:
        raise credentials_exception

    # convert ObjectId → string
    user["_id"] = str(user["_id"])

    return user