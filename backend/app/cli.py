"""Operator commands.

python -m app.cli make-admin someone@gmail.com
python -m app.cli remove-admin someone@gmail.com
python -m app.cli seed-dev            # local only: sample catalog
"""

import argparse
import sys

from sqlalchemy.orm import Session

from app.core.config import get_settings
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
    commands.add_parser("seed-dev", help="Load a sample catalog into an empty LOCAL database")
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        if args.command == "seed-dev":
            if get_settings().app_env != "local":
                print("seed-dev only runs with APP_ENV=local.", file=sys.stderr)
                return 1
            from app.dev_seed import seed_dev_catalog

            print(seed_dev_catalog(db))
            return 0

        role = UserRole.ADMIN if args.command == "make-admin" else UserRole.CUSTOMER
        try:
            print(set_role(db, args.email, role))
        except LookupError as exc:
            print(exc, file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
