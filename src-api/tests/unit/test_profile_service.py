import copy
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.profile_service import get_profile, patch_profile, update_profile


class TestGetProfile:
    @pytest.mark.asyncio
    async def test_returns_profile_when_exists(self):
        mock_profile = MagicMock()
        mock_profile.data = {"basics": {"name": "Jane"}}

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_profile

        db = AsyncMock()
        db.execute.return_value = mock_result

        result = await get_profile(db, uuid.uuid4())
        assert result is mock_profile

    @pytest.mark.asyncio
    async def test_returns_none_when_no_profile(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        db = AsyncMock()
        db.execute.return_value = mock_result

        result = await get_profile(db, uuid.uuid4())
        assert result is None


class TestUpdateProfile:
    @pytest.mark.asyncio
    async def test_replaces_existing_profile_data(self):
        mock_profile = MagicMock()
        mock_profile.data = {"basics": {"name": "Old Name"}}

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_profile

        db = AsyncMock()
        db.execute.return_value = mock_result

        new_data = {"basics": {"name": "New Name", "title": "Engineer"}}
        result = await update_profile(db, uuid.uuid4(), new_data)

        assert result.data == new_data
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_creates_profile_if_none_exists(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        db = AsyncMock()
        db.execute.return_value = mock_result

        new_data = {"basics": {"name": "Jane"}}
        result = await update_profile(db, uuid.uuid4(), new_data)

        db.add.assert_called_once()
        db.commit.assert_called_once()


class TestPatchProfile:
    @pytest.mark.asyncio
    async def test_merges_basics_field(self):
        existing_data = {
            "basics": {"name": "Jane", "title": "Engineer", "email": "jane@test.com"},
            "skills": [{"category": "Languages", "items": ["Python"]}],
        }
        mock_profile = MagicMock()
        mock_profile.data = copy.deepcopy(existing_data)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_profile

        db = AsyncMock()
        db.execute.return_value = mock_result

        patch = {"basics": {"summary": "Updated summary"}}
        result = await patch_profile(db, uuid.uuid4(), patch)

        merged = result.data
        assert merged["basics"]["name"] == "Jane"
        assert merged["basics"]["title"] == "Engineer"
        assert merged["basics"]["summary"] == "Updated summary"
        assert merged["skills"] == existing_data["skills"]

    @pytest.mark.asyncio
    async def test_replaces_list_sections(self):
        """List sections (skills, experience) are replaced entirely, not merged item-by-item."""
        existing_data = {
            "skills": [{"category": "Languages", "items": ["Python", "Go"]}],
        }
        mock_profile = MagicMock()
        mock_profile.data = copy.deepcopy(existing_data)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_profile

        db = AsyncMock()
        db.execute.return_value = mock_result

        patch = {"skills": [{"category": "Tools", "items": ["Docker"]}]}
        result = await patch_profile(db, uuid.uuid4(), patch)

        assert result.data["skills"] == [{"category": "Tools", "items": ["Docker"]}]

    @pytest.mark.asyncio
    async def test_patch_no_existing_profile_raises(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        db = AsyncMock()
        db.execute.return_value = mock_result

        with pytest.raises(ValueError, match="No profile exists"):
            await patch_profile(db, uuid.uuid4(), {"basics": {"name": "Jane"}})

    @pytest.mark.asyncio
    async def test_untouched_sections_preserved(self):
        existing_data = {
            "basics": {"name": "Jane"},
            "education": [{"institution": "MIT"}],
            "certifications": [{"name": "AWS"}],
        }
        mock_profile = MagicMock()
        mock_profile.data = copy.deepcopy(existing_data)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_profile

        db = AsyncMock()
        db.execute.return_value = mock_result

        patch = {"basics": {"title": "Staff Engineer"}}
        result = await patch_profile(db, uuid.uuid4(), patch)

        assert result.data["education"] == [{"institution": "MIT"}]
        assert result.data["certifications"] == [{"name": "AWS"}]
        assert result.data["basics"]["name"] == "Jane"
        assert result.data["basics"]["title"] == "Staff Engineer"
