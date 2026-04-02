import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.site_generator import build_input_json, run_generator, cleanup_generation_dir


SAMPLE_PROFILE = {
    "basics": {"name": "Jane Doe", "title": "Engineer", "email": "jane@test.com"},
    "skills": [{"category": "Languages", "items": ["Python"]}],
    "experience": [],
}
SAMPLE_JOB_POSTING = {"title": "Engineer", "company": "Acme", "description": "Build things"}


class TestBuildInputJson:
    def test_portfolio_input_uses_transform(self):
        site_id = uuid.uuid4()
        result = build_input_json(
            site_id=site_id,
            site_type="portfolio",
            theme="onyx",
            profile_data=SAMPLE_PROFILE,
            output_dir="/data/output/joe",
            job_posting=None,
        )
        assert result["site_id"] == str(site_id)
        assert result["output_dir"] == "/data/output/joe"
        # portfolio_data should be the transformed shape
        pd = result["portfolio_data"]
        assert pd["profile"]["fullName"] == "Jane Doe"
        assert pd["contact"]["email"] == "jane@test.com"
        assert pd["theme"] == {"name": "onyx"}
        assert pd["siteType"] == "portfolio"
        assert pd["jobPosting"] is None

    def test_targeted_input_includes_job_posting(self):
        result = build_input_json(
            site_id=uuid.uuid4(),
            site_type="targeted",
            theme="coral",
            profile_data=SAMPLE_PROFILE,
            output_dir="/data/output/joe/abc123",
            job_posting=SAMPLE_JOB_POSTING,
        )
        pd = result["portfolio_data"]
        assert pd["siteType"] == "targeted"
        assert pd["jobPosting"]["company"] == "Acme"


class TestRunGenerator:
    @pytest.mark.asyncio
    async def test_success(self):
        with patch("app.services.site_generator.asyncio") as mock_asyncio:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_asyncio.create_subprocess_exec = AsyncMock(return_value=mock_process)
            mock_process.communicate = AsyncMock(return_value=(b"Build complete", b""))

            await run_generator("/path/to/input.json")
            mock_asyncio.create_subprocess_exec.assert_called_once()

    @pytest.mark.asyncio
    async def test_failure_raises(self):
        with patch("app.services.site_generator.asyncio") as mock_asyncio:
            mock_process = MagicMock()
            mock_process.returncode = 1
            mock_asyncio.create_subprocess_exec = AsyncMock(return_value=mock_process)
            mock_process.communicate = AsyncMock(return_value=(b"", b"Error: theme not found"))

            with pytest.raises(RuntimeError, match="Generator failed.*theme not found"):
                await run_generator("/path/to/input.json")
