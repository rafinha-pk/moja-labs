import argparse
import getpass
import sys

from sqlalchemy import select

from app.auth import service
from app.db import SessionLocal
from app.errors import AppError
from app.users.models import User


def promote(email: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            sys.exit(f"user not found: {email}")
        user.is_superadmin = True
        db.commit()


def create_superadmin(email: str, name: str) -> None:
    password = getpass.getpass("Password: ")
    with SessionLocal() as db:
        try:
            service.register_user(db, email.lower(), name, password, True)
        except AppError as error:
            sys.exit(error.code)


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.manage")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("promote").add_argument("email")
    create = commands.add_parser("create-superadmin")
    create.add_argument("email")
    create.add_argument("name")
    args = parser.parse_args()
    if args.command == "promote":
        promote(args.email)
    else:
        create_superadmin(args.email, args.name)


if __name__ == "__main__":
    main()
