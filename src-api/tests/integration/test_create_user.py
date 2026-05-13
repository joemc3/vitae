import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.models import Base
from app.models.user import User
from app.scripts.create_user import create_user


@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="module")
def db_url(postgres_container):
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture
async def session_factory(db_url):
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


class TestCreateUserIntegration:
    async def test_creates_real_user_with_hashed_password(self, session_factory):
        async with session_factory() as db:
            user = await create_user(db, "real@example.com", "supersecret")
            assert user.id is not None
            assert user.password_hash != "supersecret"
            assert user.password_hash.startswith("$2")  # bcrypt prefix

        async with session_factory() as db:
            result = await db.execute(select(User).where(User.email == "real@example.com"))
            assert result.scalar_one().email == "real@example.com"

    async def test_refuses_duplicate_in_real_db(self, session_factory):
        async with session_factory() as db:
            await create_user(db, "dup@example.com", "supersecret")
        async with session_factory() as db:
            with pytest.raises(ValueError, match="already exists"):
                await create_user(db, "dup@example.com", "supersecret")
