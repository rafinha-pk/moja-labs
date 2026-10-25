import uuid
from datetime import timedelta
from functools import cache

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken
from app.auth.passwords import hash_password, verify_password
from app.auth.ratelimit import login_email_limiter, login_ip_limiter
from app.auth.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.clock import utcnow
from app.config import settings
from app.errors import AppError
from app.users.models import User


@cache
def _dummy_hash() -> str:
    return hash_password("dummy-password-for-timing")


def register_user(
    db: Session,
    email: str,
    name: str,
    password: str,
    is_superadmin: bool = False,
) -> User:
    user = User(
        email=email,
        name=name,
        password_hash=hash_password(password),
        is_superadmin=is_superadmin,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "email_already_registered") from None
    return user


def authenticate(
    db: Session, email: str, password: str, client_ip: str
) -> User:
    if login_email_limiter.is_blocked(email) or login_ip_limiter.is_blocked(
        client_ip
    ):
        raise AppError(429, "too_many_attempts")

    user = db.scalar(select(User).where(User.email == email))
    password_ok = verify_password(
        password, user.password_hash if user else _dummy_hash()
    )
    if user is None or not password_ok:
        login_email_limiter.hit(email)
        login_ip_limiter.hit(client_ip)
        raise AppError(401, "invalid_credentials")
    if not user.is_active:
        raise AppError(403, "account_blocked")

    login_email_limiter.clear(email)
    return user


def _issue_refresh_token(db: Session, user_id: int, family_id: str) -> str:
    raw = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_refresh_token(raw),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    return raw


def issue_token_pair(
    db: Session, user: User, family_id: str | None = None
) -> dict:
    refresh = _issue_refresh_token(db, user.id, family_id or str(uuid.uuid4()))
    db.commit()
    return {
        "access_token": create_access_token(user.id),
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_minutes * 60,
    }


def _revoke_family(db: Session, family_id: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )


def rotate_refresh_token(db: Session, raw_token: str) -> dict:
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw_token)
        )
    )
    if token is None:
        raise AppError(401, "invalid_refresh_token")

    if token.revoked_at is not None:
        _revoke_family(db, token.family_id)
        db.commit()
        raise AppError(401, "invalid_refresh_token")

    if token.expires_at <= utcnow():
        raise AppError(401, "invalid_refresh_token")

    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise AppError(401, "invalid_refresh_token")

    token.revoked_at = utcnow()
    return issue_token_pair(db, user, family_id=token.family_id)


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw_token)
        )
    )
    if token is not None:
        _revoke_family(db, token.family_id)
        db.commit()


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
        .values(revoked_at=utcnow())
    )


def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AppError(400, "invalid_current_password")
    user.password_hash = hash_password(new_password)
    revoke_all_user_tokens(db, user.id)
    db.commit()
