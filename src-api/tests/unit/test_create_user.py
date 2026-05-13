from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.scripts.create_user import create_user, run


class TestCreateUser:
    @pytest.mark.asyncio
    async def test_creates_user_with_hashed_password(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        with patch("app.scripts.create_user.auth_service.hash_password", return_value="hashed-pw"):
            user = await create_user(db, "joe@example.com", "supersecret")

        assert user.email == "joe@example.com"
        assert user.password_hash == "hashed-pw"
        db.add.assert_called_once()
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_refuses_duplicate_email(self):
        db = AsyncMock()
        existing = MagicMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(ValueError, match="already exists"):
            await create_user(db, "joe@example.com", "supersecret")

    @pytest.mark.asyncio
    async def test_validates_email_format(self):
        db = AsyncMock()
        with pytest.raises(ValueError, match="email"):
            await create_user(db, "not-an-email", "supersecret")

    @pytest.mark.asyncio
    async def test_requires_min_password_length(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)
        with pytest.raises(ValueError, match="password"):
            await create_user(db, "joe@example.com", "short")


class TestRunCLI:
    def test_prompts_for_password_and_confirmation(self, monkeypatch, capsys):
        """`run` should prompt twice and call create_user with the matched password."""
        prompts = iter(["supersecret", "supersecret"])
        monkeypatch.setattr("getpass.getpass", lambda prompt="": next(prompts))

        async def fake_create_user(db, email, password):
            assert email == "joe@example.com"
            assert password == "supersecret"
            user = MagicMock()
            user.id = "abc-123"
            user.email = email
            return user

        with patch("app.scripts.create_user.create_user", side_effect=fake_create_user), \
             patch("app.scripts.create_user._open_session") as mock_session:
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=AsyncMock())
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_session.return_value = ctx

            import asyncio
            asyncio.run(run("joe@example.com"))

        captured = capsys.readouterr()
        assert "Created user joe@example.com" in captured.out

    def test_aborts_on_password_mismatch(self, monkeypatch, capsys):
        prompts = iter(["password-one", "password-two"])
        monkeypatch.setattr("getpass.getpass", lambda prompt="": next(prompts))

        with pytest.raises(SystemExit):
            import asyncio
            asyncio.run(run("joe@example.com"))

        captured = capsys.readouterr()
        assert "match" in captured.err.lower() or "match" in captured.out.lower()
