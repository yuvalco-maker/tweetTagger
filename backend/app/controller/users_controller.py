from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.user_schema import createDefaultUser, createGoogleUser
from backend.app.services.users_services import (
    register_user_def,
    continue_with_google,
    login_user,
    forgot_password,
    reset_password,
    get_all_users,
    promote_user,
    get_user_activity,
)

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)


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


@auth_router.post("/forgot-password")
async def forgot_password_endpoint(request: ForgotPasswordRequest):
    try:
        return await forgot_password(request.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@auth_router.post("/reset-password")
async def reset_password_endpoint(request: ResetPasswordRequest):
    try:
        return await reset_password(request.token, request.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@users_router.get("/all")
async def get_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("isADMIN"):
        raise HTTPException(status_code=403, detail="Admin only")
    return await get_all_users()


@users_router.patch("/{user_id}/promote")
async def promote(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        return await promote_user(user_id, current_user)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@users_router.get("/{username}/activity")
async def user_activity(username: str, current_user: dict = Depends(get_current_user)):
    if not current_user.get("isADMIN"):
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return await get_user_activity(username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@users_router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user["email"],
        "isADMIN": current_user.get("isADMIN", False),
        "provider": current_user.get("provider", "local"),
    }