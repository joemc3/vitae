import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.resume_service import (
    create_general_resume,
    create_targeted_resume,
    get_resume,
    list_resumes,
    delete_resume,
    is_resume_stale,
    mark_resumes_stale,
)


class TestCreateGeneralResume:
    @pytest.mark.asyncio
    async def test_creates_resume_with_correct_fields(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        resume = await create_general_resume(
            db=mock_db,
            user_id=user_id,
            profile_id=profile_id,
            theme="onyx",
            page_target=2,
        )

        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.job_posting_id is None
        assert added.theme == "onyx"
        assert added.page_target == 2
        assert added.status == "queued"
        assert added.stale is False


class TestCreateTargetedResume:
    @pytest.mark.asyncio
    async def test_creates_resume_with_job_posting(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        job_posting_id = uuid.uuid4()

        resume = await create_targeted_resume(
            db=mock_db,
            user_id=user_id,
            profile_id=profile_id,
            job_posting_id=job_posting_id,
            theme="coral",
            page_target=1,
        )

        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.job_posting_id == job_posting_id
        assert added.theme == "coral"
        assert added.page_target == 1
        assert added.status == "queued"


class TestIsResumeStale:
    def test_stale_when_profile_updated_after_generation(self):
        profile_updated = datetime(2026, 4, 4, 12, 0, tzinfo=timezone.utc)
        resume_generated = datetime(2026, 4, 4, 10, 0, tzinfo=timezone.utc)
        assert is_resume_stale(profile_updated, resume_generated) is True

    def test_not_stale_when_generated_after_profile(self):
        profile_updated = datetime(2026, 4, 4, 10, 0, tzinfo=timezone.utc)
        resume_generated = datetime(2026, 4, 4, 12, 0, tzinfo=timezone.utc)
        assert is_resume_stale(profile_updated, resume_generated) is False

    def test_stale_when_never_generated(self):
        profile_updated = datetime(2026, 4, 4, 12, 0, tzinfo=timezone.utc)
        assert is_resume_stale(profile_updated, None) is True


class TestDeleteResume:
    @pytest.mark.asyncio
    async def test_deletes_and_returns_file_path(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()
        resume_id = uuid.uuid4()

        mock_resume = MagicMock()
        mock_resume.user_id = user_id
        mock_resume.file_path = "/data/resumes/test.pdf"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_resume
        mock_db.execute.return_value = mock_result

        result = await delete_resume(mock_db, resume_id, user_id)
        assert result == "/data/resumes/test.pdf"
        mock_db.delete.assert_called_once_with(mock_resume)

    @pytest.mark.asyncio
    async def test_raises_when_not_found(self):
        mock_db = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValueError, match="Resume not found"):
            await delete_resume(mock_db, uuid.uuid4(), uuid.uuid4())


class TestMarkResumesStale:
    @pytest.mark.asyncio
    async def test_updates_stale_flag(self):
        mock_db = AsyncMock()
        user_id = uuid.uuid4()

        await mark_resumes_stale(mock_db, user_id)

        mock_db.execute.assert_called_once()
