from pydantic import BaseModel

from app.common import Email, Name, Password


class RegisterRequest(BaseModel):
    email: Email
    name: Name
    password: Password


class LoginRequest(BaseModel):
    email: Email
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: Password


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
