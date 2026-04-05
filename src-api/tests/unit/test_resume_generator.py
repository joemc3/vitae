import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.resume_generator import (
    build_general_prompt,
    build_targeted_prompt,
    build_trim_prompt,
    parse_resume_content,
    render_resume_html,
    VALID_THEMES,
)


SAMPLE_PROFILE = {
    "basics": {
        "name": "Jordan Mitchell",
        "title": "Senior Software Engineer",
        "email": "jordan@test.com",
        "phone": "(555) 123-4567",
        "location": "San Francisco, CA",
        "summary": "12 years of distributed systems experience.",
    },
    "experience": [
        {
            "company": "Stripe",
            "title": "Staff Engineer",
            "start_date": "2020-01",
            "end_date": None,
            "highlights": ["Led payment routing migration"],
        }
    ],
    "skills": [{"category": "Languages", "items": ["Python", "Go"]}],
    "education": [
        {
            "institution": "MIT",
            "degree": "BS",
            "field": "Computer Science",
            "end_date": "2014",
        }
    ],
}

SAMPLE_RESUME_CONTENT = {
    "summary": "Experienced engineer specializing in distributed systems.",
    "experience": [
        {
            "company": "Stripe",
            "title": "Staff Engineer",
            "start_date": "2020-01",
            "end_date": None,
            "bullets": ["Led payment routing migration, reducing latency 40%"],
        }
    ],
    "skills": [{"category": "Languages", "items": ["Python", "Go"]}],
    "education": [
        {
            "institution": "MIT",
            "degree": "BS Computer Science",
            "end_date": "2014",
        }
    ],
}

SAMPLE_JOB = {
    "title": "Backend Lead",
    "company": "Acme",
    "description": "Looking for a backend lead.",
    "requirements": {"must_have": ["Python", "distributed systems"]},
}


class TestBuildGeneralPrompt:
    def test_includes_profile_data(self):
        messages = build_general_prompt(SAMPLE_PROFILE, page_target=2)
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert "Jordan Mitchell" in messages[1]["content"]
        assert "2 page" in messages[1]["content"]

    def test_includes_page_target(self):
        messages = build_general_prompt(SAMPLE_PROFILE, page_target=1)
        assert "1 page" in messages[1]["content"]


class TestBuildTargetedPrompt:
    def test_includes_job_posting(self):
        messages = build_targeted_prompt(SAMPLE_PROFILE, SAMPLE_JOB, page_target=1)
        assert len(messages) == 2
        assert "Backend Lead" in messages[1]["content"]
        assert "Acme" in messages[1]["content"]


class TestBuildTrimPrompt:
    def test_includes_page_counts(self):
        messages = build_trim_prompt(SAMPLE_RESUME_CONTENT, actual_pages=3, target_pages=2)
        assert "3 page" in messages[-1]["content"]
        assert "2 page" in messages[-1]["content"]


class TestParseResumeContent:
    def test_parses_valid_json(self):
        raw = json.dumps(SAMPLE_RESUME_CONTENT)
        result = parse_resume_content(raw)
        assert result["summary"] == SAMPLE_RESUME_CONTENT["summary"]

    def test_strips_markdown_code_block(self):
        raw = f"```json\n{json.dumps(SAMPLE_RESUME_CONTENT)}\n```"
        result = parse_resume_content(raw)
        assert result["summary"] == SAMPLE_RESUME_CONTENT["summary"]

    def test_raises_on_invalid_json(self):
        with pytest.raises(ValueError, match="Invalid JSON"):
            parse_resume_content("not json at all")


class TestRenderResumeHtml:
    @pytest.mark.xfail(reason="templates not yet created")
    def test_renders_plain_theme(self):
        html = render_resume_html(
            resume_content=SAMPLE_RESUME_CONTENT,
            basics=SAMPLE_PROFILE["basics"],
            theme="plain",
        )
        assert "Jordan Mitchell" in html
        assert "Senior Software Engineer" in html
        assert "<html" in html

    def test_raises_on_invalid_theme(self):
        with pytest.raises(ValueError, match="Unknown theme"):
            render_resume_html(
                resume_content=SAMPLE_RESUME_CONTENT,
                basics=SAMPLE_PROFILE["basics"],
                theme="nonexistent",
            )

    def test_valid_themes_list(self):
        assert "plain" in VALID_THEMES
        assert "onyx" in VALID_THEMES
        assert "coral" in VALID_THEMES
        assert "serene" in VALID_THEMES
        assert "jade" in VALID_THEMES
        assert "quartz" in VALID_THEMES
