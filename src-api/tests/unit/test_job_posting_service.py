import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.job_posting_service import (
    create_job_posting,
    get_job_posting,
    list_job_postings,
    update_job_posting,
    delete_job_posting,
)


class TestCreateJobPosting:
    @pytest.mark.asyncio
    async def test_creates_and_returns_job_posting(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()

        result = await create_job_posting(
            db=mock_db,
            user_id=user_id,
            title="Senior Engineer",
            company="Acme Corp",
            description="Build distributed systems.",
            source_url="https://example.com/jobs/123",
            raw_text="Original scraped text",
            requirements={"required_skills": ["Python", "Go"]},
        )

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        added_obj = mock_db.add.call_args[0][0]
        assert added_obj.title == "Senior Engineer"
        assert added_obj.company == "Acme Corp"
        assert added_obj.user_id == user_id
        assert added_obj.source_url == "https://example.com/jobs/123"


class TestGetJobPosting:
    @pytest.mark.asyncio
    async def test_returns_posting_for_correct_user(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        posting_id = uuid.uuid4()

        mock_posting = MagicMock()
        mock_posting.user_id = user_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_posting
        mock_db.execute.return_value = mock_result

        result = await get_job_posting(mock_db, posting_id, user_id)
        assert result is mock_posting

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await get_job_posting(mock_db, uuid.uuid4(), uuid.uuid4())
        assert result is None


class TestListJobPostings:
    @pytest.mark.asyncio
    async def test_returns_all_for_user(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        mock_postings = [MagicMock(), MagicMock()]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_postings
        mock_db.execute.return_value = mock_result

        result = await list_job_postings(mock_db, user_id)
        assert len(result) == 2


class TestUpdateJobPosting:
    @pytest.mark.asyncio
    async def test_updates_fields(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        posting_id = uuid.uuid4()

        mock_posting = MagicMock()
        mock_posting.user_id = user_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_posting
        mock_db.execute.return_value = mock_result

        result = await update_job_posting(
            mock_db, posting_id, user_id, title="Updated Title"
        )
        assert mock_posting.title == "Updated Title"
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await update_job_posting(
            mock_db, uuid.uuid4(), uuid.uuid4(), title="X"
        )
        assert result is None


class TestDeleteJobPosting:
    @pytest.mark.asyncio
    async def test_deletes_and_returns_true(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        posting_id = uuid.uuid4()

        mock_posting = MagicMock()
        mock_posting.user_id = user_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_posting
        mock_db.execute.return_value = mock_result

        result = await delete_job_posting(mock_db, posting_id, user_id)
        assert result is True
        mock_db.delete.assert_called_once_with(mock_posting)

    @pytest.mark.asyncio
    async def test_returns_false_when_not_found(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await delete_job_posting(mock_db, uuid.uuid4(), uuid.uuid4())
        assert result is False
