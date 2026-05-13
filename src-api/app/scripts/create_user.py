"""CLI to create a user account.

Usage (inside the running container):
    python -m app.scripts.create_user <email>
"""
from __future__ import annotations

import asyncio
import contextlib
import getpass
import re
import sys
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.middleware.auth import auth_service
from app.models.user import User

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MIN_PASSWORD_LEN = 8


@contextlib.asynccontextmanager
async def _open_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def create_user(db: AsyncSession, email: str, password: str) -> User:
    if not _EMAIL_RE.match(email):
        raise ValueError(f"Invalid email format: {email!r}")
    if len(password) < _MIN_PASSWORD_LEN:
        raise ValueError(
            f"password must be at least {_MIN_PASSWORD_LEN} characters"
        )

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise ValueError(f"User with email {email!r} already exists")

    user = User(
        email=email,
        password_hash=auth_service.hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def run(email: str) -> None:
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match. Aborting.", file=sys.stderr)
        sys.exit(1)

    async with _open_session() as db:
        try:
            user = await create_user(db, email, password)
        except ValueError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(2)

    print(f"Created user {user.email} ({user.id})")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.create_user <email>", file=sys.stderr)
        sys.exit(64)  # EX_USAGE
    asyncio.run(run(sys.argv[1]))


if __name__ == "__main__":
    main()
