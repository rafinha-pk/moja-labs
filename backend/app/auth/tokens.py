import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings
from app.errors import AppError

_ALGORITHM = "HS256"


def create_access_token(user_id: int) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[_ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise AppError(401, "token_expired") from None
    except jwt.InvalidTokenError:
        raise AppError(401, "invalid_token") from None
    if claims.get("type") != "access":
        raise AppError(401, "invalid_token")
    return claims


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
