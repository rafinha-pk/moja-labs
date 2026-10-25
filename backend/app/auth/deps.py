from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.tokens import decode_access_token
from app.db import get_db
from app.errors import AppError
from app.users.models import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise AppError(401, "not_authenticated")
    claims = decode_access_token(credentials.credentials)
    try:
        user_id = int(claims["sub"])
    except ValueError:
        raise AppError(401, "invalid_token") from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "invalid_token")
    return user


def require_superadmin(user: User = Depends(get_current_user)) -> User:
    if not user.is_superadmin:
        raise AppError(403, "forbidden")
    return user
