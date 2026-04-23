from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.user_schema import createDefaultUser, createGoogleUser
from backend.app.services.users_services import (
    register_user_def,
    continue_with_google,
    login_user,
)

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])


@auth_router.post("/register")
async def register(data: createDefaultUser):
    try:
        return await register_user_def(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@auth_router.post("/login", status_code=status.HTTP_200_OK)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        return await login_user(form_data.username, form_data.password)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@auth_router.post("/google", status_code=status.HTTP_200_OK)
async def on_continue_with_google(user_in: createGoogleUser):
    try:
        return await continue_with_google(user_in)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@users_router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["_id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "isADMIN": current_user.get("isADMIN", False),
        "provider": current_user.get("provider", "local"),
    }