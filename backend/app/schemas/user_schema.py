from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    email: str
    password: Optional[str] = None
    isADMIN: bool = False
    provider: str = "local"
    google_id: Optional[str] = None
    profile_pic: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class createDefaultUser(BaseModel):
    username: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class createGoogleUser(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    email: str
    isADMIN: bool

    model_config = ConfigDict(populate_by_name=True)


class PasswordResetTokenInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    token_jti: str
    expires_at: datetime
    used: bool = False
    created_at: datetime
    used_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)