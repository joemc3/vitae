import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.profile_tailor import build_tailoring_prompt, tailor_profile


SAMPLE_PROFILE = {
    "basics": {"name": "Jane Doe", "title": "Senior Engineer", "summary": "10 years experience."},
    "skills": [{"category": "Languages", "items": ["Python", "Go", "Java"]}],
    "experience": [
        {"company": "Acme", "title": "Staff Engineer", "current": True, "highlights": ["Built CI/CD"]},
        {"company": "OldCo", "title": "Junior Dev", "highlights": ["Fixed bugs"]},
    ],
}

SAMPLE_JOB_POSTING = {
    "title": "Backend Lead",
    "company": "NewCo",
    "description": "Lead backend team building Python microservices.",
    "requirements": {"required_skills": ["Python", "Docker"]},
}

TAILORED_RESPONSE = json.dumps({
    "basics": {"name": "Jane Doe", "title": "Senior Engineer", "summary": "Backend specialist with 10 years building Python services."},
    "skills": [{"category": "Languages", "items": ["Python", "Go"]}],
    "experience": [
        {"company": "Acme", "title": "Staff Engineer", "current": True, "highlights": ["Built CI/CD", "Led Python migration"]},
    ],
})


class TestBuildTailoringPrompt:
    def test_includes_profile_and_job_posting(self):
        messages = build_tailoring_prompt(SAMPLE_PROFILE, SAMPLE_JOB_POSTING)
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert "tailor" in messages[0]["content"].lower()
        user_content = messages[1]["content"]
        assert "Jane Doe" in user_content
        assert "Backend Lead" in user_content
        assert "NewCo" in user_content


class TestTailorProfile:
    @pytest.mark.asyncio
    async def test_returns_tailored_profile(self):
        mock_db = AsyncMock()
        user_id = MagicMock()

        with patch("app.services.profile_tailor.llm_service") as mock_llm:
            mock_llm.complete = AsyncMock(return_value=TAILORED_RESPONSE)

            result = await tailor_profile(
                profile_data=SAMPLE_PROFILE,
                job_posting=SAMPLE_JOB_POSTING,
                model="anthropic/claude-sonnet-4-20250514",
                user_id=user_id,
                db=mock_db,
            )

        assert result["basics"]["name"] == "Jane Doe"
        assert "Python" in result["basics"]["summary"]
        mock_llm.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_retries_on_invalid_json(self):
        mock_db = AsyncMock()
        user_id = MagicMock()

        with patch("app.services.profile_tailor.llm_service") as mock_llm:
            mock_llm.complete = AsyncMock(
                side_effect=["not json", TAILORED_RESPONSE]
            )

            result = await tailor_profile(
                profile_data=SAMPLE_PROFILE,
                job_posting=SAMPLE_JOB_POSTING,
                model="anthropic/claude-sonnet-4-20250514",
                user_id=user_id,
                db=mock_db,
            )

        assert result["basics"]["name"] == "Jane Doe"
        assert mock_llm.complete.call_count == 2
