"""Operator commands. Usage: python -m app.cli make-admin someone@gmail.com"""

import argparse
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import UserRole
from app.repositories import users as repo


def set_role(db: Session, email: str, role: UserRole) -> str:
    user = repo.get_user_by_email(db, email.strip().lower())
    if user is None:
        raise LookupError(f"No user with email {email}. They must sign in once first.")
    user.role = role
    db.commit()
    return f"{user.email} is now {role.value}."


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    for name, help_text in (
        ("make-admin", "Give a signed-in user admin access"),
        ("remove-admin", "Turn an admin back into a customer"),
    ):
        cmd = commands.add_parser(name, help=help_text)
        cmd.add_argument("email")
    args = parser.parse_args(argv)

    role = UserRole.ADMIN if args.command == "make-admin" else UserRole.CUSTOMER
    with SessionLocal() as db:
        try:
            print(set_role(db, args.email, role))
        except LookupError as exc:
            print(exc, file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
