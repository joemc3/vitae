# Phase 3d: Resume PDF Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resume PDF generation pipeline with LLM tailoring, WeasyPrint rendering, theme-matched templates, and admin UI for managing general and targeted resumes.

**Architecture:** Single-service sequential pipeline in the Python worker. LLM tailors profile content into a `ResumeContent` JSON structure, Jinja2 renders HTML from theme templates, WeasyPrint converts to PDF, a measure-and-trim loop enforces page targets. DB stores metadata + tailored content; PDFs go to disk. Admin UI provides a dedicated resume section plus contextual generate buttons on job postings.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, WeasyPrint, Jinja2, LiteLLM, arq, React 18, TypeScript, TanStack Query, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-04-phase3d-resume-pdf-generation-design.md`

**Parallelization:** Tasks 1–5 are sequential (model → schema → service → router → worker). Task 6 (templates) is independent once the service interface from Task 3 is defined. Tasks 7–9 (admin UI) are independent of each other but depend on Task 4 (router). Task 10 (stale detection) depends on Task 1. Task 11 (public download) depends on Task 3.

---

## File Map

### New files

```
src-api/app/models/resume.py
src-api/app/schemas/resume.py
src-api/app/services/resume_service.py
src-api/app/services/resume_generator.py
src-api/app/routers/resumes.py
src-api/app/templates/resume/base.html.j2
src-api/app/templates/resume/base.css
src-api/app/templates/resume/plain.html.j2
src-api/app/templates/resume/plain.css
src-api/app/templates/resume/onyx.html.j2
src-api/app/templates/resume/onyx.css
src-api/app/templates/resume/coral.html.j2
src-api/app/templates/resume/coral.css
src-api/app/templates/resume/serene.html.j2
src-api/app/templates/resume/serene.css
src-api/app/templates/resume/jade.html.j2
src-api/app/templates/resume/jade.css
src-api/app/templates/resume/quartz.html.j2
src-api/app/templates/resume/quartz.css
src-api/migrations/versions/010_resumes.py
src-api/tests/unit/test_resume_service.py
src-api/tests/unit/test_resume_generator.py
src-api/tests/unit/test_resumes_router.py
src-ui/src/pages/resumes.tsx
src-ui/src/hooks/use-resumes.ts
src-ui/src/types/resume.ts
```

### Modified files

```
src-api/app/main.py                    # Register resumes router
src-api/app/worker.py                  # Add generate_resume_job
src-api/app/routers/profile.py         # Mark resumes stale on profile update
src-api/pyproject.toml                 # Add weasyprint, jinja2
src-ui/src/layouts/app-layout.tsx       # Add Resumes nav item
src-ui/src/services/api.ts             # Add resume API functions
src-ui/src/types/api.ts                # Add resume types
src-ui/src/App.tsx                     # Add resumes route
src-ui/src/pages/sites.tsx             # Update THEMES list
```

---

## Task 1: Resume Database Model and Migration

**Files:**
- Create: `src-api/app/models/resume.py`
- Create: `src-api/migrations/versions/010_resumes.py`
- Test: `src-api/tests/unit/test_resume_service.py` (partial — model validation)

- [ ] **Step 1: Create Resume model**

Create `src-api/app/models/resume.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    job_posting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True
    )
    theme: Mapped[str] = mapped_column(String(50), nullable=False)
    page_target: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    actual_pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tailored_content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: Create Alembic migration**

Create `src-api/migrations/versions/010_resumes.py`:

```python
"""Create resumes table

Revision ID: 010
Revises: 009
Create Date: 2026-04-04
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resumes",
        sa.Column("id", sa.UUID(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("job_posting_id", sa.UUID(), nullable=True),
        sa.Column("theme", sa.String(50), nullable=False),
        sa.Column("page_target", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("actual_pages", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("tailored_content", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("stale", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_resumes_user_id")
    op.drop_table("resumes")
```

- [ ] **Step 3: Verify model imports**

Run: `cd src-api && python -c "from app.models.resume import Resume; print(Resume.__tablename__)"`

Expected output: `resumes`

- [ ] **Step 4: Commit**

```bash
git add src-api/app/models/resume.py src-api/migrations/versions/010_resumes.py
git commit -m "feat(api): add Resume model and migration"
```

---

## Task 2: Resume Schemas and Service Layer

**Files:**
- Create: `src-api/app/schemas/resume.py`
- Create: `src-api/app/services/resume_service.py`
- Create: `src-api/tests/unit/test_resume_service.py`

- [ ] **Step 1: Create Pydantic schemas**

Create `src-api/app/schemas/resume.py`:

```python
import uuid

from pydantic import BaseModel, Field


class GeneralResumeRequest(BaseModel):
    theme: str
    page_target: int = Field(default=2, ge=1, le=4)


class TargetedResumeRequest(BaseModel):
    job_posting_id: uuid.UUID
    theme: str
    page_target: int = Field(default=1, ge=1, le=4)


class ResumeResponse(BaseModel):
    id: str
    type: str  # "general" or "targeted"
    theme: str
    page_target: int
    actual_pages: int | None
    status: str
    error_message: str | None
    stale: bool
    job_posting_id: str | None
    job_posting_title: str | None
    generated_at: str | None
    created_at: str
```

- [ ] **Step 2: Write failing tests for resume service**

Create `src-api/tests/unit/test_resume_service.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_resume_service.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.resume_service'`

- [ ] **Step 4: Implement resume service**

Create `src-api/app/services/resume_service.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import Resume


def is_resume_stale(
    profile_updated_at: datetime, resume_generated_at: datetime | None
) -> bool:
    """Check if a resume is out of date relative to the profile."""
    if resume_generated_at is None:
        return True
    return profile_updated_at > resume_generated_at


async def create_general_resume(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    theme: str,
    page_target: int,
) -> Resume:
    """Create a general resume record for generation."""
    resume = Resume(
        user_id=user_id,
        profile_id=profile_id,
        job_posting_id=None,
        theme=theme,
        page_target=page_target,
        status="queued",
        stale=False,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


async def create_targeted_resume(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    job_posting_id: uuid.UUID,
    theme: str,
    page_target: int,
) -> Resume:
    """Create a targeted resume record for generation."""
    resume = Resume(
        user_id=user_id,
        profile_id=profile_id,
        job_posting_id=job_posting_id,
        theme=theme,
        page_target=page_target,
        status="queued",
        stale=False,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


async def get_resume(
    db: AsyncSession, resume_id: uuid.UUID, user_id: uuid.UUID
) -> Resume | None:
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_resumes(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Resume]:
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_resume(
    db: AsyncSession, resume_id: uuid.UUID, user_id: uuid.UUID
) -> str | None:
    """Delete a resume. Returns the file_path for cleanup. Raises if not found."""
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise ValueError("Resume not found")

    file_path = resume.file_path
    await db.delete(resume)
    await db.commit()
    return file_path


async def mark_resumes_stale(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Mark all resumes for a user as stale."""
    await db.execute(
        update(Resume)
        .where(Resume.user_id == user_id, Resume.stale.is_(False))
        .values(stale=True)
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_resume_service.py -v`

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-api/app/schemas/resume.py src-api/app/services/resume_service.py src-api/tests/unit/test_resume_service.py
git commit -m "feat(api): add resume schemas and service layer"
```

---

## Task 3: Resume Generator Service (LLM + WeasyPrint)

**Files:**
- Create: `src-api/app/services/resume_generator.py`
- Create: `src-api/tests/unit/test_resume_generator.py`
- Modify: `src-api/pyproject.toml`

- [ ] **Step 1: Add WeasyPrint dependency**

In `src-api/pyproject.toml`, add `"weasyprint>=62.0"` to the `dependencies` list (after `"litellm>=1.60.0"`).

Then run: `cd src-api && uv lock`

- [ ] **Step 2: Write failing tests for resume generator**

Create `src-api/tests/unit/test_resume_generator.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_resume_generator.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.resume_generator'`

- [ ] **Step 4: Implement resume generator**

Create `src-api/app/services/resume_generator.py`:

```python
import json
import re
import uuid
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "resume"

VALID_THEMES = ["plain", "onyx", "coral", "serene", "jade", "quartz"]

GENERAL_SYSTEM_PROMPT = """You are a professional resume writer. You will receive a person's professional profile. Your task is to produce resume content — concise, impactful, and formatted for a professional resume PDF.

Guidelines:
- Write a strong professional summary (2-3 sentences)
- Convert experience descriptions into concise achievement-oriented bullets
- Use strong action verbs and quantify results where possible
- Prioritize content by impact and relevance
- Include only the most important items — a resume is not a comprehensive list
- Target content density for the specified page count

Return ONLY valid JSON with this structure:
{
  "summary": "Professional summary text",
  "experience": [{"company": "", "title": "", "start_date": "", "end_date": null, "bullets": [""]}],
  "skills": [{"category": "", "items": [""]}],
  "education": [{"institution": "", "degree": "", "end_date": ""}],
  "certifications": [{"name": "", "issuer": "", "date": ""}],
  "projects": [{"name": "", "description": "", "technologies": [""]}],
  "publications": [{"title": "", "venue": "", "date": ""}],
  "awards": [{"title": "", "issuer": "", "date": ""}],
  "languages": [{"language": "", "proficiency": ""}]
}

Omit empty arrays. No markdown, no explanation — JSON only."""

TARGETED_SYSTEM_PROMPT = """You are a professional resume writer specializing in targeted resumes. You will receive a person's professional profile AND a specific job posting. Your task is to produce resume content tailored to that role.

Guidelines:
- Rewrite the summary to address the specific role and company
- Reorder experience to lead with the most relevant positions
- Rephrase bullets to emphasize skills and achievements matching the job requirements
- Surface matching skills prominently, de-emphasize irrelevant ones
- Drop content that isn't relevant to the target role
- Do NOT invent information — only restructure and rewrite what exists
- Target content density for the specified page count

Return ONLY valid JSON with the same structure as a general resume. No markdown, no explanation — JSON only."""


def build_general_prompt(profile_data: dict, page_target: int) -> list[dict]:
    """Build LLM messages for general resume content generation."""
    user_content = (
        f"## Professional Profile\n\n{json.dumps(profile_data, indent=2)}\n\n"
        f"## Instructions\n\n"
        f"Produce resume content targeting {page_target} page{'s' if page_target > 1 else ''}. "
        f"Calibrate the amount of content accordingly — {'be very concise, only the essentials' if page_target == 1 else 'include detail proportional to the page budget'}."
    )
    return [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_targeted_prompt(profile_data: dict, job_posting: dict, page_target: int) -> list[dict]:
    """Build LLM messages for targeted resume content generation."""
    user_content = (
        f"## Professional Profile\n\n{json.dumps(profile_data, indent=2)}\n\n"
        f"## Target Job Posting\n\n"
        f"Title: {job_posting.get('title', 'Unknown')}\n"
        f"Company: {job_posting.get('company', 'Unknown')}\n"
        f"Description: {job_posting.get('description', '')}\n"
        f"Requirements: {json.dumps(job_posting.get('requirements', {}), indent=2)}\n\n"
        f"## Instructions\n\n"
        f"Produce resume content targeting {page_target} page{'s' if page_target > 1 else ''}, "
        f"tailored specifically for this role at {job_posting.get('company', 'the company')}."
    )
    return [
        {"role": "system", "content": TARGETED_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_trim_prompt(resume_content: dict, actual_pages: int, target_pages: int) -> list[dict]:
    """Build a follow-up prompt to trim content that overflowed the page target."""
    return [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
        {
            "role": "assistant",
            "content": json.dumps(resume_content, indent=2),
        },
        {
            "role": "user",
            "content": (
                f"The rendered resume is {actual_pages} pages but the target is {target_pages} pages. "
                f"Condense the content to fit {target_pages} page{'s' if target_pages > 1 else ''}: "
                f"cut less important items, tighten bullets, remove optional sections. "
                f"Return the trimmed JSON in the same format."
            ),
        },
    ]


def parse_resume_content(text: str) -> dict:
    """Parse resume content JSON from LLM response, stripping markdown if present."""
    text = text.strip()
    code_block_match = re.match(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in LLM response: {e}") from e


def render_resume_html(resume_content: dict, basics: dict, theme: str) -> str:
    """Render resume content to HTML using the specified theme template."""
    if theme not in VALID_THEMES:
        raise ValueError(f"Unknown theme: {theme}. Valid themes: {VALID_THEMES}")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
    )
    template = env.get_template(f"{theme}.html.j2")

    # Read theme CSS
    css_path = TEMPLATES_DIR / f"{theme}.css"
    theme_css = css_path.read_text() if css_path.exists() else ""

    # Read base CSS
    base_css_path = TEMPLATES_DIR / "base.css"
    base_css = base_css_path.read_text() if base_css_path.exists() else ""

    return template.render(
        basics=basics,
        content=resume_content,
        base_css=base_css,
        theme_css=theme_css,
    )


def render_pdf(html: str) -> bytes:
    """Convert HTML to PDF bytes using WeasyPrint."""
    from weasyprint import HTML

    return HTML(string=html).write_pdf()


def count_pdf_pages(pdf_bytes: bytes) -> int:
    """Count pages in a PDF from bytes using pymupdf (already a project dependency)."""
    import fitz  # pymupdf

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    count = len(doc)
    doc.close()
    return max(count, 1)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_resume_generator.py -v`

Expected: Most tests PASS. The `render_resume_html` tests will fail until templates exist (Task 6). Mark these as `xfail` for now by adding `@pytest.mark.xfail(reason="templates not yet created")` to `TestRenderResumeHtml` tests.

- [ ] **Step 6: Commit**

```bash
git add src-api/app/services/resume_generator.py src-api/tests/unit/test_resume_generator.py src-api/pyproject.toml src-api/uv.lock
git commit -m "feat(api): add resume generator with LLM prompts and WeasyPrint rendering"
```

---

## Task 4: Resume Router (API Endpoints)

**Files:**
- Create: `src-api/app/routers/resumes.py`
- Create: `src-api/tests/unit/test_resumes_router.py`
- Modify: `src-api/app/main.py`

- [ ] **Step 1: Write failing tests for resume router**

Create `src-api/tests/unit/test_resumes_router.py`:

```python
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
def mock_auth():
    """Patch get_current_user to return a fake user."""
    with patch("app.routers.resumes.get_current_user") as mock:
        mock.return_value = {"id": str(uuid.uuid4()), "email": "test@test.com"}
        yield mock


@pytest.fixture
def mock_db():
    """Patch get_db to return a mock session."""
    mock_session = AsyncMock()
    with patch("app.routers.resumes.get_db") as mock:
        async def gen():
            yield mock_session
        mock.return_value = gen()
        yield mock_session


class TestListResumes:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/api/resumes")
        assert resp.status_code == 401


class TestGetResume:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get(f"/api/resumes/{uuid.uuid4()}")
        assert resp.status_code == 401


class TestDeleteResume:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.delete(f"/api/resumes/{uuid.uuid4()}")
        assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_resumes_router.py -v`

Expected: FAIL — router not registered yet

- [ ] **Step 3: Implement resume router**

Create `src-api/app/routers/resumes.py`:

```python
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.job_posting import JobPosting
from app.models.profile import Profile
from app.models.user import User
from app.schemas.resume import GeneralResumeRequest, ResumeResponse, TargetedResumeRequest
from app.services import resume_service

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _to_response(resume, job_posting_title: str | None = None) -> ResumeResponse:
    resume_type = "general" if resume.job_posting_id is None else "targeted"
    return ResumeResponse(
        id=str(resume.id),
        type=resume_type,
        theme=resume.theme,
        page_target=resume.page_target,
        actual_pages=resume.actual_pages,
        status=resume.status,
        error_message=resume.error_message,
        stale=resume.stale,
        job_posting_id=str(resume.job_posting_id) if resume.job_posting_id else None,
        job_posting_title=job_posting_title,
        generated_at=resume.generated_at.isoformat() if resume.generated_at else None,
        created_at=resume.created_at.isoformat(),
    )


async def _get_user_and_profile(db: AsyncSession, user_id: uuid.UUID):
    """Load user and profile, raising if not set."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Synthesize a profile before generating resumes.",
        )

    return user, profile


@router.post("/general", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def generate_general(
    request: GeneralResumeRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    user, profile = await _get_user_and_profile(db, user_id)

    resume = await resume_service.create_general_resume(
        db=db,
        user_id=user_id,
        profile_id=profile.id,
        theme=request.theme,
        page_target=request.page_target,
    )

    pool = req.app.state.arq_pool
    await pool.enqueue_job("generate_resume_job", str(resume.id))

    return _to_response(resume)


@router.post("/targeted", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def generate_targeted(
    request: TargetedResumeRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    user, profile = await _get_user_and_profile(db, user_id)

    # Verify job posting exists and belongs to user
    result = await db.execute(
        select(JobPosting).where(
            JobPosting.id == request.job_posting_id, JobPosting.user_id == user_id
        )
    )
    job_posting = result.scalar_one_or_none()
    if job_posting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found"
        )

    resume = await resume_service.create_targeted_resume(
        db=db,
        user_id=user_id,
        profile_id=profile.id,
        job_posting_id=request.job_posting_id,
        theme=request.theme,
        page_target=request.page_target,
    )

    pool = req.app.state.arq_pool
    await pool.enqueue_job("generate_resume_job", str(resume.id))

    return _to_response(resume, job_posting_title=job_posting.title)


@router.get("/", response_model=list[ResumeResponse])
async def list_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    resumes = await resume_service.list_resumes(db, user_id)

    # Batch-load job posting titles
    job_ids = {r.job_posting_id for r in resumes if r.job_posting_id}
    job_titles: dict[uuid.UUID, str] = {}
    if job_ids:
        result = await db.execute(
            select(JobPosting.id, JobPosting.title).where(JobPosting.id.in_(job_ids))
        )
        job_titles = {row.id: row.title for row in result.all()}

    return [
        _to_response(r, job_posting_title=job_titles.get(r.job_posting_id))
        for r in resumes
    ]


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    resume = await resume_service.get_resume(db, resume_id, user_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    job_title = None
    if resume.job_posting_id:
        result = await db.execute(
            select(JobPosting.title).where(JobPosting.id == resume.job_posting_id)
        )
        row = result.first()
        job_title = row.title if row else None

    return _to_response(resume, job_posting_title=job_title)


@router.get("/{resume_id}/download")
async def download_resume(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    resume = await resume_service.get_resume(db, resume_id, user_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    if resume.status != "ready" or not resume.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume is not ready for download",
        )

    file_path = Path(resume.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resume file not found on disk"
        )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=f"resume-{resume.theme}.pdf",
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    try:
        file_path = await resume_service.delete_resume(db, resume_id, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    # Clean up PDF file
    if file_path:
        path = Path(file_path)
        if path.exists():
            path.unlink()

    return None
```

- [ ] **Step 4: Register router in main.py**

In `src-api/app/main.py`, add the import and registration:

Add to the import line (line 11):
```python
from app.routers import auth, documents, job_postings, profile, resumes, settings as settings_router, sites, themes
```

Add after `app.include_router(themes.router)` (after line 72):
```python
app.include_router(resumes.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_resumes_router.py -v`

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-api/app/routers/resumes.py src-api/tests/unit/test_resumes_router.py src-api/app/main.py
git commit -m "feat(api): add resume REST endpoints"
```

---

## Task 5: Worker Job for Resume Generation

**Files:**
- Modify: `src-api/app/worker.py`

- [ ] **Step 1: Add generate_resume_job to worker**

In `src-api/app/worker.py`, add the following import at the top (after existing imports):

```python
from app.models.resume import Resume
```

Add after `from app.services.site_generator import ...` (line 21):
```python
from app.services.resume_generator import (
    build_general_prompt,
    build_targeted_prompt,
    build_trim_prompt,
    parse_resume_content,
    render_resume_html,
    render_pdf,
    count_pdf_pages,
)
```

Add the job function before the `WorkerSettings` class:

```python
async def generate_resume_job(ctx, resume_id: str):
    session_factory = ctx["session_factory"]
    async with session_factory() as session:
        result = await session.execute(
            select(Resume).where(Resume.id == uuid.UUID(resume_id))
        )
        resume = result.scalar_one_or_none()
        if resume is None:
            logger.error(f"Resume {resume_id} not found")
            return

        resume.status = "tailoring"
        await session.commit()

        try:
            # Load profile
            result = await session.execute(
                select(Profile).where(Profile.id == resume.profile_id)
            )
            profile = result.scalar_one()
            profile_data = profile.data

            # Determine LLM model
            result = await session.execute(
                select(APIKey).where(
                    APIKey.user_id == resume.user_id,
                    APIKey.selected_model.isnot(None),
                )
            )
            key_record = result.scalars().first()
            if not key_record or not key_record.selected_model:
                raise RuntimeError("No LLM model configured. Set one in Settings.")

            model = key_record.selected_model

            # Build prompt
            if resume.job_posting_id:
                result = await session.execute(
                    select(JobPosting).where(JobPosting.id == resume.job_posting_id)
                )
                job_posting = result.scalar_one()
                job_dict = {
                    "title": job_posting.title,
                    "company": job_posting.company,
                    "description": job_posting.description,
                    "requirements": job_posting.requirements,
                }
                messages = build_targeted_prompt(profile_data, job_dict, resume.page_target)
            else:
                messages = build_general_prompt(profile_data, resume.page_target)

            # LLM call
            from app.services import llm_service

            response_text = await llm_service.complete(
                model, messages, resume.user_id, session, timeout=120
            )
            resume_content = parse_resume_content(response_text)
            resume.tailored_content = resume_content

            # Render
            resume.status = "rendering"
            await session.commit()

            basics = profile_data.get("basics", {})
            html = render_resume_html(resume_content, basics, resume.theme)
            pdf_bytes = await asyncio.to_thread(render_pdf, html)
            actual_pages = count_pdf_pages(pdf_bytes)

            # Trim loop (max 2 attempts)
            trim_attempts = 0
            while actual_pages > resume.page_target and trim_attempts < 2:
                trim_attempts += 1
                logger.info(
                    f"Resume {resume_id}: {actual_pages} pages > target {resume.page_target}, "
                    f"trim attempt {trim_attempts}"
                )
                trim_messages = build_trim_prompt(resume_content, actual_pages, resume.page_target)
                response_text = await llm_service.complete(
                    model, trim_messages, resume.user_id, session, timeout=120
                )
                resume_content = parse_resume_content(response_text)
                resume.tailored_content = resume_content

                html = render_resume_html(resume_content, basics, resume.theme)
                pdf_bytes = await asyncio.to_thread(render_pdf, html)
                actual_pages = count_pdf_pages(pdf_bytes)

            # Save PDF to disk
            resume_dir = Path(settings.output_dir) / "resumes" / str(resume.user_id)
            resume_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = resume_dir / f"{resume.id}.pdf"
            pdf_path.write_bytes(pdf_bytes)

            # If general resume, also copy to portfolio output for public download
            if resume.job_posting_id is None:
                result = await session.execute(
                    select(User).where(User.id == resume.user_id)
                )
                user = result.scalar_one()
                if user.username:
                    public_dir = Path(settings.output_dir) / user.username
                    public_dir.mkdir(parents=True, exist_ok=True)
                    public_pdf = public_dir / "resume.pdf"
                    public_pdf.write_bytes(pdf_bytes)
                    logger.info(f"Copied general resume to {public_pdf}")

            # Success
            resume.file_path = str(pdf_path)
            resume.actual_pages = actual_pages
            resume.status = "ready"
            resume.generated_at = datetime.now(timezone.utc)
            logger.info(f"Generated resume {resume_id}: {actual_pages} pages")

        except Exception as e:
            logger.error(f"Failed to generate resume {resume_id}: {e}")
            resume.status = "failed"
            resume.error_message = str(e)

        finally:
            await session.commit()
```

Update `WorkerSettings.functions` to include the new job:

```python
class WorkerSettings:
    functions = [parse_document_job, generate_site_job, generate_resume_job]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = get_redis_settings()
```

- [ ] **Step 2: Verify imports work**

Run: `cd src-api && python -c "from app.worker import WorkerSettings; print([f.__name__ for f in WorkerSettings.functions])"`

Expected output: `['parse_document_job', 'generate_site_job', 'generate_resume_job']`

- [ ] **Step 3: Commit**

```bash
git add src-api/app/worker.py
git commit -m "feat(api): add generate_resume_job to worker"
```

---

## Task 6: Resume Templates (Jinja2 + CSS)

**Files:**
- Create: `src-api/app/templates/resume/base.html.j2`
- Create: `src-api/app/templates/resume/base.css`
- Create: `src-api/app/templates/resume/plain.html.j2`
- Create: `src-api/app/templates/resume/plain.css`
- Create: `src-api/app/templates/resume/onyx.html.j2`
- Create: `src-api/app/templates/resume/onyx.css`
- Create: `src-api/app/templates/resume/coral.html.j2`
- Create: `src-api/app/templates/resume/coral.css`
- Create: `src-api/app/templates/resume/serene.html.j2`
- Create: `src-api/app/templates/resume/serene.css`
- Create: `src-api/app/templates/resume/jade.html.j2`
- Create: `src-api/app/templates/resume/jade.css`
- Create: `src-api/app/templates/resume/quartz.html.j2`
- Create: `src-api/app/templates/resume/quartz.css`

This task is large. Each theme has its own personality but shares the same base structure. The base template (`base.html.j2`) defines the HTML document skeleton and section ordering. Each theme template extends it and provides visual overrides.

- [ ] **Step 1: Create base CSS**

Create `src-api/app/templates/resume/base.css`:

```css
/* Base resume styles — shared across all themes */
@page {
    size: letter;
    margin: 0.6in 0.7in;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    font-size: 10pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

body {
    font-family: var(--font-body, 'Helvetica Neue', Helvetica, Arial, sans-serif);
    color: var(--color-text, #1a1a1a);
    background: var(--color-bg, #ffffff);
}

h1, h2, h3 {
    font-family: var(--font-heading, var(--font-body));
    font-weight: var(--heading-weight, 700);
}

h1 {
    font-size: var(--h1-size, 18pt);
    line-height: 1.2;
}

h2 {
    font-size: var(--h2-size, 10pt);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 12pt;
    margin-bottom: 4pt;
    color: var(--color-heading, var(--color-text));
}

h3 {
    font-size: var(--h3-size, 10pt);
    font-weight: 600;
}

.header {
    margin-bottom: 10pt;
}

.header .name {
    font-size: var(--h1-size, 18pt);
    font-weight: var(--heading-weight, 700);
    color: var(--color-name, var(--color-text));
}

.header .title {
    font-size: 11pt;
    color: var(--color-subtitle, #555);
    margin-top: 2pt;
}

.header .contact {
    font-size: 8pt;
    color: var(--color-contact, #666);
    margin-top: 4pt;
}

.header .contact span + span::before {
    content: " · ";
}

.section {
    margin-top: 10pt;
}

.section-title {
    font-size: var(--h2-size, 10pt);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-heading, var(--color-text));
    margin-bottom: 4pt;
    padding-bottom: 2pt;
    border-bottom: var(--section-border, 0.5pt solid #ccc);
}

.entry {
    margin-bottom: 6pt;
    break-inside: avoid;
}

.entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}

.entry-title {
    font-weight: 600;
    font-size: 10pt;
}

.entry-subtitle {
    font-size: 9pt;
    color: var(--color-subtitle, #555);
}

.entry-date {
    font-size: 8.5pt;
    color: var(--color-date, #888);
    white-space: nowrap;
}

.entry-bullets {
    list-style: none;
    padding-left: 0;
    margin-top: 2pt;
}

.entry-bullets li {
    font-size: 9pt;
    padding-left: 10pt;
    position: relative;
    margin-bottom: 1pt;
}

.entry-bullets li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--color-bullet, var(--color-text));
}

.skills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2pt 16pt;
    font-size: 9pt;
}

.skill-category {
    margin-bottom: 2pt;
}

.skill-category .label {
    font-weight: 600;
    color: var(--color-heading, var(--color-text));
}

.compact-list {
    font-size: 9pt;
}

.compact-list .item {
    margin-bottom: 2pt;
}

.compact-list .item-title {
    font-weight: 600;
}

.compact-list .item-detail {
    color: var(--color-subtitle, #555);
}
```

- [ ] **Step 2: Create base template**

Create `src-api/app/templates/resume/base.html.j2`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>{{ base_css }}</style>
    <style>{{ theme_css }}</style>
    {% block extra_head %}{% endblock %}
</head>
<body>
    {% block header %}
    <div class="header">
        <div class="name">{{ basics.name or "Name" }}</div>
        {% if basics.title %}<div class="title">{{ basics.title }}</div>{% endif %}
        <div class="contact">
            {% if basics.email %}<span>{{ basics.email }}</span>{% endif %}
            {% if basics.phone %}<span>{{ basics.phone }}</span>{% endif %}
            {% if basics.location %}<span>{{ basics.location }}</span>{% endif %}
            {% if basics.linkedin %}<span>{{ basics.linkedin }}</span>{% endif %}
            {% if basics.website %}<span>{{ basics.website }}</span>{% endif %}
        </div>
    </div>
    {% endblock %}

    {% block divider %}{% endblock %}

    {% if content.summary %}
    {% block summary %}
    <div class="section">
        <div class="section-title">Summary</div>
        <p style="font-size: 9pt;">{{ content.summary }}</p>
    </div>
    {% endblock %}
    {% endif %}

    {% if content.experience %}
    {% block experience %}
    <div class="section">
        <div class="section-title">Experience</div>
        {% for exp in content.experience %}
        <div class="entry">
            <div class="entry-header">
                <div>
                    <span class="entry-title">{{ exp.title }}</span>
                    {% if exp.company %}<span class="entry-subtitle"> — {{ exp.company }}</span>{% endif %}
                </div>
                <span class="entry-date">{{ exp.start_date or "" }}{% if exp.start_date %} – {% endif %}{{ exp.end_date or "Present" }}</span>
            </div>
            {% if exp.bullets %}
            <ul class="entry-bullets">
                {% for bullet in exp.bullets %}
                <li>{{ bullet }}</li>
                {% endfor %}
            </ul>
            {% endif %}
        </div>
        {% endfor %}
    </div>
    {% endblock %}
    {% endif %}

    {% if content.skills %}
    {% block skills %}
    <div class="section">
        <div class="section-title">Skills</div>
        <div class="skills-grid">
            {% for cat in content.skills %}
            <div class="skill-category">
                <span class="label">{{ cat.category }}:</span>
                {{ cat.items | join(", ") }}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endblock %}
    {% endif %}

    {% if content.education %}
    {% block education %}
    <div class="section">
        <div class="section-title">Education</div>
        {% for edu in content.education %}
        <div class="entry">
            <div class="entry-header">
                <div>
                    <span class="entry-title">{{ edu.degree }}</span>
                    {% if edu.institution %}<span class="entry-subtitle"> — {{ edu.institution }}</span>{% endif %}
                </div>
                {% if edu.end_date %}<span class="entry-date">{{ edu.end_date }}</span>{% endif %}
            </div>
        </div>
        {% endfor %}
    </div>
    {% endblock %}
    {% endif %}

    {% if content.certifications %}
    {% block certifications %}
    <div class="section">
        <div class="section-title">Certifications</div>
        <div class="compact-list">
            {% for cert in content.certifications %}
            <div class="item">
                <span class="item-title">{{ cert.name }}</span>
                {% if cert.issuer %}<span class="item-detail"> — {{ cert.issuer }}</span>{% endif %}
                {% if cert.date %}<span class="entry-date"> ({{ cert.date }})</span>{% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endblock %}
    {% endif %}

    {% if content.projects %}
    {% block projects %}
    <div class="section">
        <div class="section-title">Projects</div>
        {% for proj in content.projects %}
        <div class="entry">
            <span class="entry-title">{{ proj.name }}</span>
            {% if proj.description %}<p style="font-size: 9pt; margin-top: 1pt;">{{ proj.description }}</p>{% endif %}
            {% if proj.technologies %}<p style="font-size: 8pt; color: var(--color-subtitle, #555); margin-top: 1pt;">{{ proj.technologies | join(", ") }}</p>{% endif %}
        </div>
        {% endfor %}
    </div>
    {% endblock %}
    {% endif %}

    {% if content.publications %}
    {% block publications %}
    <div class="section">
        <div class="section-title">Publications</div>
        <div class="compact-list">
            {% for pub in content.publications %}
            <div class="item">
                <span class="item-title">{{ pub.title }}</span>
                {% if pub.venue %}<span class="item-detail"> — {{ pub.venue }}</span>{% endif %}
                {% if pub.date %}<span class="entry-date"> ({{ pub.date }})</span>{% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endblock %}
    {% endif %}

    {% if content.awards %}
    {% block awards %}
    <div class="section">
        <div class="section-title">Awards</div>
        <div class="compact-list">
            {% for award in content.awards %}
            <div class="item">
                <span class="item-title">{{ award.title }}</span>
                {% if award.issuer %}<span class="item-detail"> — {{ award.issuer }}</span>{% endif %}
                {% if award.date %}<span class="entry-date"> ({{ award.date }})</span>{% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endblock %}
    {% endif %}

    {% if content.languages %}
    {% block languages %}
    <div class="section">
        <div class="section-title">Languages</div>
        <div class="compact-list">
            {% for lang in content.languages %}
            <div class="item">
                <span class="item-title">{{ lang.language }}</span>
                {% if lang.proficiency %}<span class="item-detail"> — {{ lang.proficiency }}</span>{% endif %}
            </div>
            {% endfor %}
        </div>
    </div>
    {% endblock %}
    {% endif %}
</body>
</html>
```

- [ ] **Step 3: Create Plain theme**

Create `src-api/app/templates/resume/plain.html.j2`:

```html
{% extends "base.html.j2" %}
```

Create `src-api/app/templates/resume/plain.css`:

```css
:root {
    --font-body: Georgia, 'Times New Roman', serif;
    --font-heading: Georgia, 'Times New Roman', serif;
    --heading-weight: 700;
    --h1-size: 18pt;
    --h2-size: 9pt;
    --color-text: #111111;
    --color-bg: #ffffff;
    --color-heading: #111111;
    --color-name: #111111;
    --color-subtitle: #444444;
    --color-contact: #555555;
    --color-date: #555555;
    --color-bullet: #111111;
    --section-border: 0.75pt solid #333333;
}

.header {
    text-align: center;
    border-bottom: 1pt solid #333;
    padding-bottom: 8pt;
}
```

- [ ] **Step 4: Create Onyx theme**

Create `src-api/app/templates/resume/onyx.html.j2`:

```html
{% extends "base.html.j2" %}

{% block divider %}
<div style="height: 1px; background: linear-gradient(to right, #374151, transparent); margin: 8pt 0;"></div>
{% endblock %}
```

Create `src-api/app/templates/resume/onyx.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=JetBrains+Mono:wght@500&display=swap');

:root {
    --font-body: 'Inter', 'Helvetica Neue', sans-serif;
    --font-heading: 'Inter', 'Helvetica Neue', sans-serif;
    --heading-weight: 600;
    --h1-size: 20pt;
    --h2-size: 8.5pt;
    --color-text: #1a1a1a;
    --color-bg: #fafafa;
    --color-heading: #6b7280;
    --color-name: #1a1a1a;
    --color-subtitle: #6b7280;
    --color-contact: #9ca3af;
    --color-date: #9ca3af;
    --color-bullet: #6b7280;
    --section-border: none;
}

.header .name {
    font-weight: 300;
    letter-spacing: 2px;
}

.section-title {
    letter-spacing: 2px;
    font-weight: 600;
    border-bottom: none;
    background: linear-gradient(to right, #374151, transparent);
    -webkit-background-clip: text;
    background-clip: text;
    padding-bottom: 0;
    margin-bottom: 6pt;
}

.section-title::after {
    content: "";
    display: block;
    height: 0.5pt;
    background: linear-gradient(to right, #374151, transparent);
    margin-top: 3pt;
}
```

- [ ] **Step 5: Create Coral theme**

Create `src-api/app/templates/resume/coral.html.j2`:

```html
{% extends "base.html.j2" %}

{% block header %}
<div class="header coral-header">
    <div class="name">{{ basics.name or "Name" }}</div>
    {% if basics.title %}<div class="title">{{ basics.title }}</div>{% endif %}
    <div class="contact">
        {% if basics.email %}<span>{{ basics.email }}</span>{% endif %}
        {% if basics.phone %}<span>{{ basics.phone }}</span>{% endif %}
        {% if basics.location %}<span>{{ basics.location }}</span>{% endif %}
        {% if basics.linkedin %}<span>{{ basics.linkedin }}</span>{% endif %}
        {% if basics.website %}<span>{{ basics.website }}</span>{% endif %}
    </div>
</div>
{% endblock %}
```

Create `src-api/app/templates/resume/coral.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=DM+Sans:wght@400;500&display=swap');

:root {
    --font-body: 'DM Sans', sans-serif;
    --font-heading: 'Poppins', sans-serif;
    --heading-weight: 700;
    --h1-size: 20pt;
    --h2-size: 9pt;
    --color-text: #2d2420;
    --color-bg: #fffaf7;
    --color-heading: #d4553a;
    --color-name: #d4553a;
    --color-subtitle: #8b7355;
    --color-contact: #8b7355;
    --color-date: #8b7355;
    --color-bullet: #f4a261;
    --section-border: 2pt solid #f4a261;
}

body {
    border-left: 5pt solid #d4553a;
    padding-left: 8pt;
}

.coral-header .name {
    color: #d4553a;
}

.section-title {
    color: #d4553a;
    border-bottom-color: #f4a261;
    border-bottom-width: 2pt;
}

.entry {
    padding-left: 6pt;
    border-left: 1.5pt solid #f4a261;
}

.skills-grid .skill-category {
    background: #fff5f0;
    padding: 2pt 6pt;
    border-radius: 2pt;
}
```

- [ ] **Step 6: Create Serene theme**

Create `src-api/app/templates/resume/serene.html.j2`:

```html
{% extends "base.html.j2" %}
```

Create `src-api/app/templates/resume/serene.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Source+Sans+3:wght@300;400;600&display=swap');

:root {
    --font-body: 'Source Sans 3', sans-serif;
    --font-heading: 'Source Sans 3', sans-serif;
    --heading-weight: 600;
    --h1-size: 20pt;
    --h2-size: 9pt;
    --color-text: #2c3e50;
    --color-bg: #ffffff;
    --color-heading: #5a8f9e;
    --color-name: #2c3e50;
    --color-subtitle: #7f8c8d;
    --color-contact: #95a5a6;
    --color-date: #95a5a6;
    --color-bullet: #5a8f9e;
    --section-border: 0.5pt solid #d5e8ed;
}

.header {
    text-align: center;
    padding-bottom: 10pt;
    margin-bottom: 6pt;
}

.header .name {
    font-weight: 300;
    letter-spacing: 3px;
}

.header .title {
    font-weight: 300;
    color: #5a8f9e;
}

.section {
    margin-top: 12pt;
}
```

- [ ] **Step 7: Create Jade theme**

Create `src-api/app/templates/resume/jade.html.j2`:

```html
{% extends "base.html.j2" %}
```

Create `src-api/app/templates/resume/jade.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap');

:root {
    --font-body: 'Open Sans', sans-serif;
    --font-heading: 'Merriweather', serif;
    --heading-weight: 700;
    --h1-size: 18pt;
    --h2-size: 9pt;
    --color-text: #2d3b2d;
    --color-bg: #fafdf7;
    --color-heading: #4a7c59;
    --color-name: #2d3b2d;
    --color-subtitle: #5f7a5f;
    --color-contact: #7a947a;
    --color-date: #7a947a;
    --color-bullet: #4a7c59;
    --section-border: 0.75pt solid #c2d4b7;
}

.header {
    border-bottom: 1.5pt solid #4a7c59;
    padding-bottom: 8pt;
}

.section-title {
    color: #4a7c59;
}
```

- [ ] **Step 8: Create Quartz theme**

Create `src-api/app/templates/resume/quartz.html.j2`:

```html
{% extends "base.html.j2" %}
```

Create `src-api/app/templates/resume/quartz.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');

:root {
    --font-body: 'IBM Plex Sans', sans-serif;
    --font-heading: 'IBM Plex Sans', sans-serif;
    --heading-weight: 600;
    --h1-size: 18pt;
    --h2-size: 9pt;
    --color-text: #1e293b;
    --color-bg: #ffffff;
    --color-heading: #475569;
    --color-name: #0f172a;
    --color-subtitle: #64748b;
    --color-contact: #94a3b8;
    --color-date: #94a3b8;
    --color-bullet: #475569;
    --section-border: 0.5pt solid #e2e8f0;
}

.header {
    border-bottom: 2pt solid #0f172a;
    padding-bottom: 8pt;
}

.header .name {
    font-weight: 600;
    letter-spacing: 1px;
}

.section-title {
    font-weight: 600;
    color: #0f172a;
    background: #f8fafc;
    padding: 2pt 4pt;
    border: none;
    border-left: 2pt solid #0f172a;
}
```

- [ ] **Step 9: Remove xfail markers from generator tests**

In `src-api/tests/unit/test_resume_generator.py`, remove any `@pytest.mark.xfail` decorators added in Task 3.

- [ ] **Step 10: Run template rendering tests**

Run: `cd src-api && uv run pytest tests/unit/test_resume_generator.py::TestRenderResumeHtml -v`

Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add src-api/app/templates/
git commit -m "feat(api): add resume PDF templates for all 6 themes"
```

---

## Task 7: Admin UI — Types, API Functions, and Hooks

**Files:**
- Create: `src-ui/src/types/resume.ts`
- Create: `src-ui/src/hooks/use-resumes.ts`
- Modify: `src-ui/src/services/api.ts`

- [ ] **Step 1: Add resume types**

Create `src-ui/src/types/resume.ts`:

```typescript
export interface GeneralResumeRequest {
  theme: string;
  page_target: number;
}

export interface TargetedResumeRequest {
  job_posting_id: string;
  theme: string;
  page_target: number;
}

export interface ResumeResponse {
  id: string;
  type: string; // "general" | "targeted"
  theme: string;
  page_target: number;
  actual_pages: number | null;
  status: string;
  error_message: string | null;
  stale: boolean;
  job_posting_id: string | null;
  job_posting_title: string | null;
  generated_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add resume API functions**

In `src-ui/src/services/api.ts`, add the import at the top (add to the import block):

```typescript
import type {
  GeneralResumeRequest,
  TargetedResumeRequest,
  ResumeResponse,
} from '@/types/resume';
```

Add at the end of the file (after the Settings section):

```typescript
// Resumes
export async function getResumes(): Promise<ResumeResponse[]> {
  const res = await api.get<ResumeResponse[]>('/api/resumes');
  return res.data;
}

export async function getResume(id: string): Promise<ResumeResponse> {
  const res = await api.get<ResumeResponse>(`/api/resumes/${id}`);
  return res.data;
}

export async function generateGeneralResume(
  data: GeneralResumeRequest
): Promise<ResumeResponse> {
  const res = await api.post<ResumeResponse>('/api/resumes/general', data);
  return res.data;
}

export async function generateTargetedResume(
  data: TargetedResumeRequest
): Promise<ResumeResponse> {
  const res = await api.post<ResumeResponse>('/api/resumes/targeted', data);
  return res.data;
}

export async function deleteResume(id: string): Promise<void> {
  await api.delete(`/api/resumes/${id}`);
}

export async function downloadResume(id: string): Promise<void> {
  const res = await api.get(`/api/resumes/${id}/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `resume-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Create resume hooks**

Create `src-ui/src/hooks/use-resumes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GeneralResumeRequest, TargetedResumeRequest } from '@/types/resume';
import * as api from '@/services/api';

export function useResumes() {
  return useQuery({
    queryKey: ['resumes'],
    queryFn: () => api.getResumes(),
  });
}

export function useResumesPolling() {
  const query = useResumes();
  const hasActiveJobs = query.data?.some(
    (r) => r.status === 'queued' || r.status === 'tailoring' || r.status === 'rendering'
  );

  return useQuery({
    queryKey: ['resumes'],
    queryFn: () => api.getResumes(),
    refetchInterval: hasActiveJobs ? 3000 : false,
  });
}

export function useResume(id: string) {
  return useQuery({
    queryKey: ['resumes', id],
    queryFn: () => api.getResume(id),
    enabled: !!id,
  });
}

export function useGenerateGeneralResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GeneralResumeRequest) => api.generateGeneralResume(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
}

export function useGenerateTargetedResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TargetedResumeRequest) => api.generateTargetedResume(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src-ui/src/types/resume.ts src-ui/src/hooks/use-resumes.ts src-ui/src/services/api.ts
git commit -m "feat(ui): add resume types, API functions, and TanStack Query hooks"
```

---

## Task 8: Admin UI — Resumes Page

**Files:**
- Create: `src-ui/src/pages/resumes.tsx`
- Modify: `src-ui/src/layouts/app-layout.tsx`
- Modify: `src-ui/src/App.tsx`

- [ ] **Step 1: Create Resumes page**

Create `src-ui/src/pages/resumes.tsx`:

```tsx
import { useState } from 'react';
import {
  useResumesPolling,
  useGenerateGeneralResume,
  useGenerateTargetedResume,
  useDeleteResume,
} from '@/hooks/use-resumes';
import { useJobPostings } from '@/hooks/use-job-postings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { downloadResume } from '@/services/api';
import type { ResumeResponse } from '@/types/resume';

const THEMES = [
  { value: 'plain', label: 'Plain (B&W)' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'coral', label: 'Coral' },
  { value: 'serene', label: 'Serene' },
  { value: 'jade', label: 'Jade' },
  { value: 'quartz', label: 'Quartz' },
];

const PAGE_OPTIONS = [1, 2, 3, 4];

function statusBadge(status: string) {
  switch (status) {
    case 'ready':
      return <Badge>Ready</Badge>;
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>;
    case 'tailoring':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Tailoring
        </Badge>
      );
    case 'rendering':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Rendering
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ResumesPage() {
  const { data: resumes, isLoading, error } = useResumesPolling();
  const { data: jobPostings } = useJobPostings();
  const genGeneral = useGenerateGeneralResume();
  const genTargeted = useGenerateTargetedResume();
  const deleteMut = useDeleteResume();

  const [showGeneralDialog, setShowGeneralDialog] = useState(false);
  const [showTargetedDialog, setShowTargetedDialog] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('plain');
  const [selectedPages, setSelectedPages] = useState('2');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ResumeResponse | null>(null);
  const [genError, setGenError] = useState('');

  const handleGenerateGeneral = async () => {
    setGenError('');
    try {
      await genGeneral.mutateAsync({
        theme: selectedTheme,
        page_target: parseInt(selectedPages, 10),
      });
      setShowGeneralDialog(false);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      setGenError(detail || 'Generation failed');
    }
  };

  const handleGenerateTargeted = async () => {
    setGenError('');
    try {
      await genTargeted.mutateAsync({
        job_posting_id: selectedJobId,
        theme: selectedTheme,
        page_target: parseInt(selectedPages, 10),
      });
      setShowTargetedDialog(false);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      setGenError(detail || 'Generation failed');
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Resumes</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setGenError('');
                setSelectedPages('2');
                setShowGeneralDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              General Resume
            </Button>
            <Button
              onClick={() => {
                setGenError('');
                setSelectedPages('1');
                setShowTargetedDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Targeted Resume
            </Button>
          </div>
        </div>

        {genError && (
          <Alert variant="destructive">
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load resumes.</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {resumes && resumes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-lg font-medium">No resumes generated yet</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Generate a <strong>general resume</strong> from your full profile, or a{' '}
                <strong>targeted resume</strong> tailored to a specific job posting.
              </p>
            </CardContent>
          </Card>
        )}

        {resumes && resumes.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumes.map((resume) => (
                  <TableRow key={resume.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={resume.type === 'general' ? 'default' : 'secondary'}>
                          {resume.type}
                        </Badge>
                        {resume.stale && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Profile updated since generation. Consider regenerating.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {resume.job_posting_title && (
                          <span className="text-sm text-muted-foreground">
                            {resume.job_posting_title}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{resume.theme}</TableCell>
                    <TableCell>
                      {resume.actual_pages ?? resume.page_target}
                      {resume.actual_pages && resume.actual_pages !== resume.page_target && (
                        <span className="text-muted-foreground text-xs ml-1">
                          (target: {resume.page_target})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(resume.status)}</TableCell>
                    <TableCell>{formatDate(resume.generated_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {resume.status === 'ready' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => downloadResume(resume.id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download PDF</TooltipContent>
                          </Tooltip>
                        )}
                        {resume.status === 'failed' && resume.error_message && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>{resume.error_message}</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(resume)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* General Resume Dialog */}
        <Dialog open={showGeneralDialog} onOpenChange={setShowGeneralDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate General Resume</DialogTitle>
              <DialogDescription>
                Create a resume from your full synthesized profile.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Pages</label>
                <Select value={selectedPages} onValueChange={setSelectedPages}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} page{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGeneralDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateGeneral} disabled={genGeneral.isPending}>
                {genGeneral.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Targeted Resume Dialog */}
        <Dialog open={showTargetedDialog} onOpenChange={setShowTargetedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Targeted Resume</DialogTitle>
              <DialogDescription>
                Create a resume tailored to a specific job posting.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Posting</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job posting" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobPostings?.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>
                        {jp.title} — {jp.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Pages</label>
                <Select value={selectedPages} onValueChange={setSelectedPages}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} page{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTargetedDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateTargeted}
                disabled={!selectedJobId || genTargeted.isPending}
              >
                {genTargeted.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete resume?</DialogTitle>
              <DialogDescription>
                This will permanently remove the resume and its PDF file.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Add Resumes to sidebar navigation**

In `src-ui/src/layouts/app-layout.tsx`, add `FileText` to the `lucide-react` import if not already present (it is — used by Documents), and add the nav item.

Add to the `navItems` array (after the Sites entry, before Settings):

```typescript
  { to: '/app/resumes', label: 'Resumes', icon: FileText },
```

Note: `FileText` is already imported. But it's also used by Documents. We need a different icon for Resumes. Use `FileDown` instead:

Add `FileDown` to the lucide-react import, then use:

```typescript
  { to: '/app/resumes', label: 'Resumes', icon: FileDown },
```

- [ ] **Step 3: Add route in App.tsx**

In `src-ui/src/App.tsx`, add the import:

```typescript
import ResumesPage from '@/pages/resumes';
```

Add the route (after the Sites route, before Settings):

```tsx
<Route path="resumes" element={<ResumesPage />} />
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd src-ui && npm run build`

Expected: Build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src-ui/src/pages/resumes.tsx src-ui/src/layouts/app-layout.tsx src-ui/src/App.tsx
git commit -m "feat(ui): add Resumes page with generation dialogs and polling"
```

---

## Task 9: Update Sites Page Theme List

**Files:**
- Modify: `src-ui/src/pages/sites.tsx`

- [ ] **Step 1: Update THEMES constant**

In `src-ui/src/pages/sites.tsx`, replace the `THEMES` constant (line 48):

```typescript
const THEMES = [
  { value: 'onyx', label: 'Onyx' },
  { value: 'coral', label: 'Coral' },
  { value: 'serene', label: 'Serene' },
  { value: 'jade', label: 'Jade' },
  { value: 'quartz', label: 'Quartz' },
];
```

Then update all references from `THEMES.map((t) => ...)` to use `t.value` and `t.label` instead of just `t`:

In the Portfolio Dialog Select (around line 232):
```tsx
{THEMES.map((t) => (
  <SelectItem key={t.value} value={t.value}>
    {t.label}
  </SelectItem>
))}
```

In the Targeted Dialog Select (around line 268):
```tsx
{THEMES.map((t) => (
  <SelectItem key={t.value} value={t.value}>
    {t.label}
  </SelectItem>
))}
```

Also update `selectedTheme` default to `THEMES[0].value`:
```typescript
const [selectedTheme, setSelectedTheme] = useState(THEMES[0].value);
```

- [ ] **Step 2: Verify build**

Run: `cd src-ui && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src-ui/src/pages/sites.tsx
git commit -m "feat(ui): update sites page with new theme options"
```

---

## Task 10: Stale Detection for Resumes

**Files:**
- Modify: `src-api/app/routers/profile.py`

- [ ] **Step 1: Add stale marking on profile update**

In `src-api/app/routers/profile.py`, add the import at the top:

```python
from app.services.resume_service import mark_resumes_stale
```

In the `update_profile_endpoint` function (PUT), add after `profile = await profile_service.update_profile(...)`:

```python
    await mark_resumes_stale(db, user_id)
```

In the `patch_profile_endpoint` function (PATCH), add after `profile = await profile_service.patch_profile(...)`:

```python
    await mark_resumes_stale(db, user_id)
```

In the `synthesize_profile_endpoint` function, add inside the `event_stream` after the `yield _sse_event("complete", ...)` line:

```python
            # Mark resumes stale after re-synthesis
            await mark_resumes_stale(db, user_id)
```

- [ ] **Step 2: Run existing profile tests**

Run: `cd src-api && uv run pytest tests/unit/ -v -k "profile"`

Expected: All existing tests still PASS

- [ ] **Step 3: Commit**

```bash
git add src-api/app/routers/profile.py
git commit -m "feat(api): mark resumes stale on profile update"
```

---

## Task 11: Run All Tests and Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all backend unit tests**

Run: `cd src-api && uv run pytest tests/unit/ -v`

Expected: All tests PASS

- [ ] **Step 2: Run frontend build**

Run: `cd src-ui && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Run frontend lint**

Run: `cd src-ui && npm run lint`

Expected: No errors

- [ ] **Step 4: Verify model import chain**

Run: `cd src-api && python -c "from app.models.resume import Resume; from app.services.resume_service import create_general_resume; from app.services.resume_generator import render_resume_html, VALID_THEMES; from app.routers.resumes import router; print('All imports OK'); print(f'Themes: {VALID_THEMES}')"`

Expected:
```
All imports OK
Themes: ['plain', 'onyx', 'coral', 'serene', 'jade', 'quartz']
```

- [ ] **Step 5: Update CLAUDE.md**

Add the resume endpoints to the "Currently Implemented" section under REST API Endpoints:

```markdown
- `POST /api/resumes/general` — Generate general resume PDF (JWT required)
- `POST /api/resumes/targeted` — Generate targeted resume PDF for a job posting (JWT required)
- `GET /api/resumes` — List all resumes with stale indicators (JWT required)
- `GET /api/resumes/:id` — Get resume details (JWT required)
- `GET /api/resumes/:id/download` — Download resume PDF (JWT required)
- `DELETE /api/resumes/:id` — Delete resume and PDF file (JWT required)
```

Update the "Current tables" line to include `resumes`.

Update the "Current Phase" section to reflect Phase 3d completion.

Remove the resume endpoints from the "Planned" section.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 3d completion"
```
