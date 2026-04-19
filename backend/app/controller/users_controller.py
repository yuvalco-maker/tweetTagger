from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from fastapi.security import OAuth2PasswordRequestForm
from backend.app.schemas.user_schema import createDefaultUser, createGoogleUser
from backend.app.services.users_services import register_user_def
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.user_schema import createGoogleUser
from backend.app.services.users_services import continue_with_google

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
async def register(data: createDefaultUser):
    try:
        return await register_user_def(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/google", status_code=status.HTTP_200_OK)
async def on_continue_with_google(user_in: createGoogleUser):
    try:
        result = await continue_with_google(user_in)
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )
