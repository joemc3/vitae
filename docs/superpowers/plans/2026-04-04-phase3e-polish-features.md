# Phase 3e-A: Polish Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live preview system, profile photo upload, and resume download link to complete the user-facing feature set before deployment.

**Architecture:** Three independent features that converge in the generator's theme layer. Photo upload adds a column + upload endpoint + Pillow resize. Resume link adds a boolean flag to the site generation payload. Live preview adds a Next.js dev server managed by the API with proxy endpoints. All five themes get photo and resume link support.

**Tech Stack:** Python/FastAPI, Pillow (image resize), Next.js dev mode (SSR preview), React/TypeScript (admin UI), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-04-phase3e-polish-features-design.md`

---

## File Structure

### New Files
- `src-api/migrations/versions/011_profile_photo_path.py` — migration
- `src-api/app/services/photo_service.py` — validate, resize, save, delete photos
- `src-api/app/services/preview_service.py` — generator process lifecycle + preview data
- `src-api/app/routers/preview.py` — preview API endpoints
- `src-api/app/schemas/preview.py` — preview request/response models
- `src-api/tests/unit/test_photo_service.py` — photo service tests
- `src-api/tests/unit/test_preview_service.py` — preview service tests
- `src-api/tests/unit/test_photo_router.py` — photo endpoint tests
- `src-api/tests/unit/test_preview_router.py` — preview endpoint tests
- `src-generator/app/preview/[id]/page.tsx` — SSR preview route
- `src-generator/sample-data/showcase.json` — sample portfolio data for screenshots
- `src-ui/src/components/PhotoUpload.tsx` — drag-and-drop photo upload component
- `src-ui/src/components/ThemeGallery.tsx` — theme card gallery component
- `src-ui/src/components/PreviewModal.tsx` — iframe preview modal
- `src-ui/src/hooks/use-preview.ts` — preview TanStack Query hooks

### Modified Files
- `src-api/app/models/profile.py` — add `photo_path` column
- `src-api/app/routers/profile.py` — add photo upload/delete endpoints
- `src-api/app/services/profile_transform.py` — add `hasResume` field to output
- `src-api/app/worker.py` — copy photo to output dir during site generation, pass `hasResume`
- `src-api/app/main.py` — mount preview router
- `src-api/app/config.py` — add `generator_dir` setting
- `src-generator/app/types/portfolio.ts` — add `hasResume` field
- `src-generator/app/lib/loadPortfolioData.ts` — add preview data loader function
- `src-generator/app/themes/onyx/components/OnyxNav.tsx` — resume download link
- `src-generator/app/themes/onyx/components/OnyxHero.tsx` — (already has photo)
- `src-generator/app/themes/coral/portfolio.tsx` — resume link + photo
- `src-generator/app/themes/serene/portfolio.tsx` — resume link + photo
- `src-generator/app/themes/jade/portfolio.tsx` — resume link + photo
- `src-generator/app/themes/quartz/portfolio.tsx` — resume link + photo
- `src-ui/src/pages/profile.tsx` — add photo upload section
- `src-ui/src/pages/sites.tsx` — replace theme dropdown with gallery + preview
- `src-ui/src/services/api.ts` — add photo + preview API functions
- `src-ui/src/types/api.ts` — add photo + preview types
- `src-ui/src/hooks/use-profile.ts` — add photo mutation hooks
- `src-ui/src/hooks/use-sites.ts` — add preview hooks

---

## Task 1: Database Migration — Add photo_path to profiles

**Files:**
- Create: `src-api/migrations/versions/011_profile_photo_path.py`
- Modify: `src-api/app/models/profile.py`

- [ ] **Step 1: Add photo_path column to Profile model**

In `src-api/app/models/profile.py`, add after the `guidance` column:

```python
photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Add `String` to the sqlalchemy imports (or use `Text` which is already imported).

- [ ] **Step 2: Create the Alembic migration**

Create `src-api/migrations/versions/011_profile_photo_path.py`:

```python
"""Add photo_path to profiles

Revision ID: 011
Revises: 010
Create Date: 2026-04-04
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("photo_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "photo_path")
```

- [ ] **Step 3: Verify migration applies**

Run: `cd src-api && uv run alembic upgrade head` (or verify via unit tests that the model loads cleanly)

- [ ] **Step 4: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/models/profile.py src-api/migrations/versions/011_profile_photo_path.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(db): add photo_path column to profiles table"
```

---

## Task 2: Photo Service — Validate, Resize, Save, Delete

**Files:**
- Create: `src-api/app/services/photo_service.py`
- Create: `src-api/tests/unit/test_photo_service.py`

- [ ] **Step 1: Write failing tests for photo validation**

Create `src-api/tests/unit/test_photo_service.py`:

```python
import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.photo_service import (
    validate_photo,
    resize_photo,
    save_photo,
    delete_photo,
    ALLOWED_TYPES,
    MAX_SIZE_BYTES,
    MAX_DIMENSION,
)


class TestValidatePhoto:
    def test_rejects_invalid_content_type(self):
        with pytest.raises(ValueError, match="File type"):
            validate_photo(content_type="application/pdf", size=1000)

    def test_rejects_oversized_file(self):
        with pytest.raises(ValueError, match="exceeds"):
            validate_photo(content_type="image/jpeg", size=MAX_SIZE_BYTES + 1)

    def test_accepts_valid_jpeg(self):
        validate_photo(content_type="image/jpeg", size=1000)

    def test_accepts_valid_png(self):
        validate_photo(content_type="image/png", size=1000)

    def test_accepts_valid_webp(self):
        validate_photo(content_type="image/webp", size=1000)


class TestResizePhoto:
    def test_resizes_large_image(self):
        # Create a 1600x1200 test image
        from PIL import Image

        img = Image.new("RGB", (1600, 1200), color="red")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        assert max(resized.size) <= MAX_DIMENSION

    def test_preserves_small_image(self):
        from PIL import Image

        img = Image.new("RGB", (400, 300), color="blue")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        assert resized.size == (400, 300)

    def test_preserves_aspect_ratio(self):
        from PIL import Image

        img = Image.new("RGB", (1600, 800), color="green")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        w, h = resized.size
        assert abs(w / h - 2.0) < 0.01  # ~2:1 ratio preserved


class TestSavePhoto:
    def test_saves_file_and_returns_path(self, tmp_path):
        user_id = uuid.uuid4()
        photo_bytes = b"fake-image-data"

        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            path = save_photo(user_id, photo_bytes, "image/jpeg")

        assert path.startswith(f"photos/{user_id}/profile.")
        assert (tmp_path / path).exists()

    def test_overwrites_existing(self, tmp_path):
        user_id = uuid.uuid4()

        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            path1 = save_photo(user_id, b"data1", "image/jpeg")
            path2 = save_photo(user_id, b"data2", "image/jpeg")

        assert path1 == path2
        assert (tmp_path / path2).read_bytes() == b"data2"


class TestDeletePhoto:
    def test_deletes_existing_file(self, tmp_path):
        user_id = uuid.uuid4()
        photo_dir = tmp_path / "photos" / str(user_id)
        photo_dir.mkdir(parents=True)
        photo_file = photo_dir / "profile.jpg"
        photo_file.write_bytes(b"data")

        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            delete_photo(f"photos/{user_id}/profile.jpg")

        assert not photo_file.exists()

    def test_ignores_missing_file(self, tmp_path):
        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            delete_photo("photos/nonexistent/profile.jpg")  # no error
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_photo_service.py -v`
Expected: FAIL — `ImportError: cannot import name 'validate_photo'`

- [ ] **Step 3: Implement photo service**

Create `src-api/app/services/photo_service.py`:

```python
"""Photo upload, validation, resize, and storage."""

import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.config import settings

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 800

MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MIME_TO_FORMAT = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def validate_photo(content_type: str, size: int) -> None:
    """Raise ValueError if the file is not a valid photo."""
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"File type {content_type} not allowed. Use JPEG, PNG, or WebP.")
    if size > MAX_SIZE_BYTES:
        raise ValueError(f"File size {size} bytes exceeds maximum of {MAX_SIZE_BYTES} bytes.")


def resize_photo(data: bytes, content_type: str) -> bytes:
    """Resize image so longest dimension is at most MAX_DIMENSION. Returns bytes."""
    img = Image.open(BytesIO(data))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        if w >= h:
            new_w = MAX_DIMENSION
            new_h = int(h * MAX_DIMENSION / w)
        else:
            new_h = MAX_DIMENSION
            new_w = int(w * MAX_DIMENSION / h)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = BytesIO()
    fmt = MIME_TO_FORMAT.get(content_type, "JPEG")
    img.save(buf, format=fmt, quality=85)
    return buf.getvalue()


def save_photo(user_id: uuid.UUID, data: bytes, content_type: str) -> str:
    """Save photo bytes to disk. Returns relative path."""
    ext = MIME_TO_EXT.get(content_type, "jpg")
    rel_path = f"photos/{user_id}/profile.{ext}"
    full_path = Path(settings.upload_dir) / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Remove any existing photo with different extension
    for existing in full_path.parent.glob("profile.*"):
        existing.unlink()

    full_path.write_bytes(data)
    return rel_path


def delete_photo(rel_path: str) -> None:
    """Delete a photo file from disk."""
    full_path = Path(settings.upload_dir) / rel_path
    if full_path.exists():
        full_path.unlink()
```

- [ ] **Step 4: Add Pillow to dependencies**

Run: `cd src-api && uv add Pillow`

(Note DNS workaround: if `files.pythonhosted.org` fails, use `uv add Pillow --default-index "https://pypi.tuna.tsinghua.edu.cn/simple"`)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_photo_service.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/services/photo_service.py src-api/tests/unit/test_photo_service.py src-api/pyproject.toml src-api/uv.lock
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(api): add photo service with validation, resize, and storage"
```

---

## Task 3: Photo API Endpoints

**Files:**
- Modify: `src-api/app/routers/profile.py`
- Create: `src-api/tests/unit/test_photo_router.py`

- [ ] **Step 1: Write failing tests for photo endpoints**

Create `src-api/tests/unit/test_photo_router.py`:

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


class TestUploadPhoto:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.post("/api/profile/photo")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_rejects_missing_file(self, client):
        with patch("app.routers.profile.get_current_user") as mock_auth:
            mock_auth.return_value = {"id": str(uuid.uuid4()), "email": "t@t.com"}
            with patch("app.routers.profile.get_db"):
                resp = await client.post("/api/profile/photo")
                assert resp.status_code == 422


class TestDeletePhoto:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.delete("/api/profile/photo")
        assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_photo_router.py -v`
Expected: FAIL (404 — endpoints don't exist yet)

- [ ] **Step 3: Implement photo endpoints on profile router**

Add to `src-api/app/routers/profile.py`:

At the top, add imports:
```python
from fastapi import UploadFile, File
from app.services.photo_service import validate_photo, resize_photo, save_photo, delete_photo
```

Add two new endpoints after the existing ones:

```python
@router.post("/photo", response_model=ProfileResponse)
async def upload_photo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    profile = await profile_service.get_profile(db, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile exists")

    # Validate
    try:
        validate_photo(file.content_type or "", file.size or 0)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Read, resize, save
    data = await file.read()
    resized = resize_photo(data, file.content_type or "image/jpeg")
    rel_path = save_photo(user_id, resized, file.content_type or "image/jpeg")

    # Update profile
    profile.photo_path = rel_path
    await db.commit()
    await db.refresh(profile)

    return ProfileResponse(
        id=str(profile.id),
        data=ProfileData(**profile.data),
        guidance=profile.guidance,
        generated_at=profile.generated_at.isoformat() if profile.generated_at else None,
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.delete("/photo", response_model=ProfileResponse)
async def remove_photo(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    profile = await profile_service.get_profile(db, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile exists")

    if profile.photo_path:
        delete_photo(profile.photo_path)
        profile.photo_path = None
        await db.commit()
        await db.refresh(profile)

    return ProfileResponse(
        id=str(profile.id),
        data=ProfileData(**profile.data),
        guidance=profile.guidance,
        generated_at=profile.generated_at.isoformat() if profile.generated_at else None,
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )
```

- [ ] **Step 4: Add photo_path to ProfileResponse schema**

In `src-api/app/schemas/profile.py`, add `photo_path: str | None = None` to `ProfileResponse`.

Update all places that construct `ProfileResponse` in `profile.py` router to include `photo_path=profile.photo_path`.

- [ ] **Step 5: Run tests**

Run: `cd src-api && uv run pytest tests/unit/test_photo_router.py -v`
Expected: All PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/routers/profile.py src-api/app/schemas/profile.py src-api/tests/unit/test_photo_router.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(api): add photo upload and delete endpoints"
```

---

## Task 4: Add hasResume to Generator Data Contract

**Files:**
- Modify: `src-generator/app/types/portfolio.ts`
- Modify: `src-api/app/services/profile_transform.py`
- Modify: `src-api/tests/unit/test_profile_transform.py` (if exists, else create)

- [ ] **Step 1: Write failing test for hasResume in transform**

Add to or create `src-api/tests/unit/test_profile_transform.py`:

```python
import pytest

from app.services.profile_transform import transform_profile_for_generator


SAMPLE_PROFILE = {
    "basics": {"name": "Jane", "title": "Engineer", "email": "j@t.com"},
    "skills": [],
    "experience": [],
}


class TestTransformHasResume:
    def test_includes_has_resume_true(self):
        result = transform_profile_for_generator(
            profile_data=SAMPLE_PROFILE,
            theme="onyx",
            site_type="portfolio",
            job_posting=None,
            has_resume=True,
        )
        assert result["hasResume"] is True

    def test_includes_has_resume_false(self):
        result = transform_profile_for_generator(
            profile_data=SAMPLE_PROFILE,
            theme="onyx",
            site_type="portfolio",
            job_posting=None,
            has_resume=False,
        )
        assert result["hasResume"] is False

    def test_defaults_has_resume_false(self):
        result = transform_profile_for_generator(
            profile_data=SAMPLE_PROFILE,
            theme="onyx",
            site_type="portfolio",
            job_posting=None,
        )
        assert result["hasResume"] is False


class TestTransformPhotoPath:
    def test_includes_photo_from_basics(self):
        profile = {**SAMPLE_PROFILE, "basics": {**SAMPLE_PROFILE["basics"], "photo": "/photos/123/profile.jpg"}}
        result = transform_profile_for_generator(
            profile_data=profile,
            theme="onyx",
            site_type="portfolio",
        )
        assert result["profile"]["photo"] == "/photos/123/profile.jpg"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-api && uv run pytest tests/unit/test_profile_transform.py -v`
Expected: FAIL — `TypeError: transform_profile_for_generator() got an unexpected keyword argument 'has_resume'`

- [ ] **Step 3: Add has_resume parameter to transform**

In `src-api/app/services/profile_transform.py`, change the function signature:

```python
def transform_profile_for_generator(
    profile_data: dict,
    theme: str,
    site_type: str,
    job_posting: dict | None = None,
    has_resume: bool = False,
) -> dict:
```

Add `"hasResume": has_resume,` to the returned dict (after the `"jobPosting"` line).

- [ ] **Step 4: Add hasResume to TypeScript PortfolioData**

In `src-generator/app/types/portfolio.ts`, add to the `PortfolioData` interface:

```typescript
hasResume?: boolean;
```

- [ ] **Step 5: Run tests**

Run: `cd src-api && uv run pytest tests/unit/test_profile_transform.py -v`
Expected: All PASS

- [ ] **Step 6: Update callers — build_input_json and worker**

In `src-api/app/services/site_generator.py`, update `build_input_json` to accept and pass `has_resume`:

```python
def build_input_json(
    site_id: uuid.UUID,
    site_type: str,
    theme: str,
    profile_data: dict,
    output_dir: str,
    job_posting: dict | None = None,
    has_resume: bool = False,
) -> dict:
    portfolio_data = transform_profile_for_generator(
        profile_data=profile_data,
        theme=theme,
        site_type=site_type,
        job_posting=job_posting,
        has_resume=has_resume,
    )
    return {
        "site_id": str(site_id),
        "output_dir": output_dir,
        "portfolio_data": portfolio_data,
    }
```

In `src-api/app/worker.py`, in `generate_site_job`, after loading the profile and before `build_input_json`, check for a non-stale general resume:

```python
# Check if user has a non-stale general resume
from app.models.resume import Resume as ResumeModel
result = await session.execute(
    select(ResumeModel).where(
        ResumeModel.user_id == site.user_id,
        ResumeModel.job_posting_id.is_(None),
        ResumeModel.status == "ready",
        ResumeModel.stale == False,
    )
)
has_resume = result.scalar_one_or_none() is not None
```

Then pass `has_resume=has_resume` to `build_input_json()`.

- [ ] **Step 7: Run full unit tests**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/services/profile_transform.py src-api/app/services/site_generator.py src-api/app/worker.py src-api/tests/unit/test_profile_transform.py src-generator/app/types/portfolio.ts
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat: add hasResume flag to site generation data contract"
```

---

## Task 5: Photo Copy During Site Generation

**Files:**
- Modify: `src-api/app/worker.py`

- [ ] **Step 1: Add photo copy logic to generate_site_job**

In `src-api/app/worker.py`, in `generate_site_job`, after `await run_generator(input_path)` succeeds but before setting `site.status = "ready"`, add:

```python
# Copy profile photo to output if it exists
if profile.photo_path:
    src_photo = Path(settings.upload_dir) / profile.photo_path
    if src_photo.exists():
        dst_photo = Path(output_dir) / "profile-photo" / src_photo.name
        dst_photo.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(str(src_photo), str(dst_photo))
```

Also update the portfolio_data to include the photo URL. Before calling `build_input_json`, if profile.photo_path exists, set the photo in profile_data:

```python
# Set photo URL for generator (relative to site root)
if profile.photo_path:
    src_photo = Path(settings.upload_dir) / profile.photo_path
    if src_photo.exists():
        if "basics" not in profile_data:
            profile_data["basics"] = {}
        profile_data["basics"]["photo"] = f"profile-photo/{src_photo.name}"
```

- [ ] **Step 2: Run tests**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/worker.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(worker): copy profile photo to site output during generation"
```

---

## Task 6: Theme Updates — Resume Download Link

Add a conditional "Download Resume" link to all 5 themes when `hasResume` is true.

**Files:**
- Modify: `src-generator/app/themes/onyx/components/OnyxNav.tsx`
- Modify: `src-generator/app/themes/coral/portfolio.tsx`
- Modify: `src-generator/app/themes/serene/portfolio.tsx`
- Modify: `src-generator/app/themes/jade/portfolio.tsx`
- Modify: `src-generator/app/themes/quartz/portfolio.tsx`

- [ ] **Step 1: Add resume link to Onyx nav**

In `src-generator/app/themes/onyx/components/OnyxNav.tsx`, the component receives `data: PortfolioData`. Add the resume link to the nav links array, before the contact link:

```tsx
if (data.hasResume) links.push({ id: 'resume-download', label: 'Resume' });
links.push({ id: 'contact', label: 'Contact' });
```

And change the link rendering to handle the resume download link specially:

```tsx
{links.map((link) => (
  <li key={link.id}>
    {link.id === 'resume-download' ? (
      <a
        href="resume.pdf"
        download
        className="text-gray-300 hover:text-[var(--accent-blue)] transition-colors"
      >
        {link.label}
      </a>
    ) : (
      <a
        href={`#${link.id}`}
        className="text-gray-300 hover:text-[var(--accent-blue)] transition-colors"
      >
        {link.label}
      </a>
    )}
  </li>
))}
```

- [ ] **Step 2: Add resume link to Coral portfolio**

Read `src-generator/app/themes/coral/portfolio.tsx` to find the nav or hero section. Add a conditional resume download link in the appropriate location (typically nav or hero CTA area). The link should be:

```tsx
{data.hasResume && (
  <a href="resume.pdf" download className="[theme-appropriate-classes]">
    Download Resume
  </a>
)}
```

The exact classes depend on Coral's styling. Place it in the hero CTA area alongside any existing buttons.

- [ ] **Step 3: Add resume link to Serene portfolio**

Same pattern for Serene — read the portfolio file, find the hero/nav area, add the conditional download link with Serene's styling.

- [ ] **Step 4: Add resume link to Jade portfolio**

Same pattern for Jade.

- [ ] **Step 5: Add resume link to Quartz portfolio**

Same pattern for Quartz.

- [ ] **Step 6: Verify generator builds**

Run: `cd src-generator && npm run build`
Expected: Build succeeds (using default sample data)

- [ ] **Step 7: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-generator/app/themes/
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(themes): add conditional resume download link to all themes"
```

---

## Task 7: Preview Service — Generator Process Lifecycle

**Files:**
- Create: `src-api/app/services/preview_service.py`
- Create: `src-api/tests/unit/test_preview_service.py`
- Modify: `src-api/app/config.py`

- [ ] **Step 1: Add generator_dir to config**

In `src-api/app/config.py`, add:

```python
generator_dir: str = "/app/generator"
preview_port: int = 3002
preview_timeout_seconds: int = 300  # 5 minutes of inactivity
```

- [ ] **Step 2: Write failing tests for preview service**

Create `src-api/tests/unit/test_preview_service.py`:

```python
import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.preview_service import (
    prepare_preview_data,
    cleanup_preview,
)


SAMPLE_PROFILE = {
    "basics": {"name": "Jane", "title": "Engineer"},
    "skills": [],
    "experience": [],
}


class TestPreparePreviewData:
    def test_writes_json_file(self, tmp_path):
        preview_id = uuid.uuid4()
        with patch("app.services.preview_service.settings") as mock_settings:
            mock_settings.generation_dir = str(tmp_path)
            prepare_preview_data(
                preview_id=preview_id,
                theme="onyx",
                site_type="portfolio",
                profile_data=SAMPLE_PROFILE,
            )

        data_file = tmp_path / "preview" / str(preview_id) / "portfolio-data.json"
        assert data_file.exists()
        data = json.loads(data_file.read_text())
        assert data["profile"]["fullName"] == "Jane"
        assert data["theme"]["name"] == "onyx"
        assert data["siteType"] == "portfolio"

    def test_targeted_includes_job_posting(self, tmp_path):
        preview_id = uuid.uuid4()
        job_posting = {"title": "Dev", "company": "Acme", "description": "Build"}
        with patch("app.services.preview_service.settings") as mock_settings:
            mock_settings.generation_dir = str(tmp_path)
            prepare_preview_data(
                preview_id=preview_id,
                theme="coral",
                site_type="targeted",
                profile_data=SAMPLE_PROFILE,
                job_posting=job_posting,
            )

        data_file = tmp_path / "preview" / str(preview_id) / "portfolio-data.json"
        data = json.loads(data_file.read_text())
        assert data["siteType"] == "targeted"
        assert data["jobPosting"]["company"] == "Acme"


class TestCleanupPreview:
    def test_removes_preview_directory(self, tmp_path):
        preview_id = uuid.uuid4()
        preview_dir = tmp_path / "preview" / str(preview_id)
        preview_dir.mkdir(parents=True)
        (preview_dir / "portfolio-data.json").write_text("{}")

        with patch("app.services.preview_service.settings") as mock_settings:
            mock_settings.generation_dir = str(tmp_path)
            cleanup_preview(preview_id)

        assert not preview_dir.exists()

    def test_ignores_missing_directory(self, tmp_path):
        with patch("app.services.preview_service.settings") as mock_settings:
            mock_settings.generation_dir = str(tmp_path)
            cleanup_preview(uuid.uuid4())  # no error
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_preview_service.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 4: Implement preview service**

Create `src-api/app/services/preview_service.py`:

```python
"""Preview service — manages preview data and generator process for live theme preview."""

import asyncio
import json
import logging
import shutil
import time
import uuid
from pathlib import Path

from app.config import settings
from app.services.profile_transform import transform_profile_for_generator

logger = logging.getLogger(__name__)

# Module-level state for the generator process
_generator_process: asyncio.subprocess.Process | None = None
_generator_last_used: float = 0.0
_generator_lock = asyncio.Lock()


def prepare_preview_data(
    preview_id: uuid.UUID,
    theme: str,
    site_type: str,
    profile_data: dict,
    job_posting: dict | None = None,
    has_resume: bool = False,
    photo_url: str | None = None,
) -> Path:
    """Write transformed portfolio data for preview. Returns the data directory."""
    portfolio_data = transform_profile_for_generator(
        profile_data=profile_data,
        theme=theme,
        site_type=site_type,
        job_posting=job_posting,
        has_resume=has_resume,
    )

    if photo_url:
        portfolio_data["profile"]["photo"] = photo_url

    preview_dir = Path(settings.generation_dir) / "preview" / str(preview_id)
    preview_dir.mkdir(parents=True, exist_ok=True)

    data_file = preview_dir / "portfolio-data.json"
    data_file.write_text(json.dumps(portfolio_data, indent=2))

    return preview_dir


def cleanup_preview(preview_id: uuid.UUID) -> None:
    """Remove preview data directory."""
    preview_dir = Path(settings.generation_dir) / "preview" / str(preview_id)
    if preview_dir.exists():
        shutil.rmtree(preview_dir)


async def ensure_generator_running() -> int:
    """Start the generator dev server if not running. Returns the port."""
    global _generator_process, _generator_last_used

    async with _generator_lock:
        _generator_last_used = time.time()

        if _generator_process is not None and _generator_process.returncode is None:
            return settings.preview_port

        logger.info("Starting generator dev server for preview...")
        _generator_process = await asyncio.create_subprocess_exec(
            "npx", "next", "dev", "--port", str(settings.preview_port),
            cwd=settings.generator_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Wait briefly for the server to start
        await asyncio.sleep(3)

        if _generator_process.returncode is not None:
            stderr = await _generator_process.stderr.read() if _generator_process.stderr else b""
            raise RuntimeError(f"Generator failed to start: {stderr.decode()}")

        logger.info(f"Generator dev server running on port {settings.preview_port}")
        return settings.preview_port


async def stop_generator() -> None:
    """Stop the generator dev server."""
    global _generator_process

    async with _generator_lock:
        if _generator_process is not None and _generator_process.returncode is None:
            _generator_process.terminate()
            try:
                await asyncio.wait_for(_generator_process.wait(), timeout=5)
            except asyncio.TimeoutError:
                _generator_process.kill()
            logger.info("Generator dev server stopped")
        _generator_process = None


async def check_idle_timeout() -> None:
    """Stop the generator if it's been idle too long."""
    global _generator_last_used
    if _generator_process is not None and _generator_process.returncode is None:
        if time.time() - _generator_last_used > settings.preview_timeout_seconds:
            await stop_generator()
```

- [ ] **Step 5: Run tests**

Run: `cd src-api && uv run pytest tests/unit/test_preview_service.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/services/preview_service.py src-api/tests/unit/test_preview_service.py src-api/app/config.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(api): add preview service with generator lifecycle management"
```

---

## Task 8: Preview API Endpoints

**Files:**
- Create: `src-api/app/schemas/preview.py`
- Create: `src-api/app/routers/preview.py`
- Create: `src-api/tests/unit/test_preview_router.py`
- Modify: `src-api/app/main.py`

- [ ] **Step 1: Create preview schemas**

Create `src-api/app/schemas/preview.py`:

```python
import uuid

from pydantic import BaseModel


class PreviewRequest(BaseModel):
    theme: str
    site_type: str = "portfolio"
    job_posting_id: uuid.UUID | None = None


class PreviewResponse(BaseModel):
    preview_id: str
```

- [ ] **Step 2: Write failing tests**

Create `src-api/tests/unit/test_preview_router.py`:

```python
import uuid
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


class TestCreatePreview:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.post("/api/preview", json={"theme": "onyx"})
        assert resp.status_code == 401


class TestGetPreview:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get(f"/api/preview/{uuid.uuid4()}")
        assert resp.status_code == 401
```

- [ ] **Step 3: Implement preview router**

Create `src-api/app/routers/preview.py`:

```python
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.job_posting import JobPosting
from app.models.profile import Profile
from app.models.resume import Resume
from app.schemas.preview import PreviewRequest, PreviewResponse
from app.services.preview_service import (
    cleanup_preview,
    ensure_generator_running,
    prepare_preview_data,
)

router = APIRouter(prefix="/api/preview", tags=["preview"])


@router.post("/", response_model=PreviewResponse, status_code=status.HTTP_201_CREATED)
async def create_preview(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])

    # Load profile
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Synthesize a profile before previewing.",
        )

    # Load job posting if targeted
    job_posting_dict = None
    if request.job_posting_id:
        result = await db.execute(
            select(JobPosting).where(
                JobPosting.id == request.job_posting_id,
                JobPosting.user_id == user_id,
            )
        )
        jp = result.scalar_one_or_none()
        if jp is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
        job_posting_dict = {
            "title": jp.title,
            "company": jp.company,
            "description": jp.description,
            "requirements": jp.requirements,
        }

    # Check for non-stale general resume
    result = await db.execute(
        select(Resume).where(
            Resume.user_id == user_id,
            Resume.job_posting_id.is_(None),
            Resume.status == "ready",
            Resume.stale == False,
        )
    )
    has_resume = result.scalar_one_or_none() is not None

    # Photo URL
    photo_url = None
    if profile.photo_path:
        photo_url = f"/api/profile/photo/file"  # served by the API

    # Prepare data
    preview_id = uuid.uuid4()
    prepare_preview_data(
        preview_id=preview_id,
        theme=request.theme,
        site_type=request.site_type,
        profile_data=profile.data,
        job_posting=job_posting_dict,
        has_resume=has_resume,
        photo_url=photo_url,
    )

    # Ensure generator is running
    await ensure_generator_running()

    return PreviewResponse(preview_id=str(preview_id))


@router.get("/{preview_id}", response_class=HTMLResponse)
async def get_preview(
    preview_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    """Proxy the rendered preview page from the generator dev server."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://localhost:{settings.preview_port}/preview/{preview_id}",
                timeout=30.0,
            )
            return HTMLResponse(content=resp.text, status_code=resp.status_code)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Preview server is not ready. Try again in a few seconds.",
        )


@router.delete("/{preview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preview(
    preview_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    cleanup_preview(preview_id)
    return None
```

- [ ] **Step 4: Add httpx to dependencies**

Run: `cd src-api && uv add httpx`

- [ ] **Step 5: Mount preview router in main.py**

In `src-api/app/main.py`, add import:
```python
from app.routers import preview
```

Add router:
```python
app.include_router(preview.router)
```

- [ ] **Step 6: Run tests**

Run: `cd src-api && uv run pytest tests/unit/test_preview_router.py -v`
Expected: All PASS

- [ ] **Step 7: Run full test suite**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-api/app/schemas/preview.py src-api/app/routers/preview.py src-api/tests/unit/test_preview_router.py src-api/app/main.py src-api/pyproject.toml src-api/uv.lock
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(api): add preview endpoints with generator proxy"
```

---

## Task 9: Generator Preview Route

**Files:**
- Create: `src-generator/app/preview/[id]/page.tsx`
- Modify: `src-generator/app/lib/loadPortfolioData.ts`

- [ ] **Step 1: Add preview data loader function**

In `src-generator/app/lib/loadPortfolioData.ts`, add:

```typescript
/**
 * Load preview data for a specific preview ID.
 * Preview data is written by the API to .data/preview/{id}/portfolio-data.json
 * relative to the generation directory.
 */
export function loadPreviewData(previewId: string): PortfolioData {
  // In dev mode, check multiple possible locations
  const possiblePaths = [
    path.join(process.cwd(), '.data', 'preview', previewId, 'portfolio-data.json'),
    path.join('/data/generation', 'preview', previewId, 'portfolio-data.json'),
  ];

  for (const dataPath of possiblePaths) {
    try {
      const fileContents = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(fileContents) as PortfolioData;
    } catch {
      continue;
    }
  }

  console.error(`Preview data not found for ID: ${previewId}`);
  return getDefaultPortfolioData();
}
```

- [ ] **Step 2: Create preview page route**

Create `src-generator/app/preview/[id]/page.tsx`:

```tsx
import { loadPreviewData } from '@/lib/loadPortfolioData';

import { jetbrainsMono, inter as onyxInter } from '@/themes/onyx/fonts';
import OnyxPortfolio from '@/themes/onyx/portfolio';
import OnyxTargeted from '@/themes/onyx/targeted';

import { poppins, dmSans } from '@/themes/coral/fonts';
import CoralPortfolio from '@/themes/coral/portfolio';
import CoralTargeted from '@/themes/coral/targeted';

import { sourceSerif, sourceSans } from '@/themes/serene/fonts';
import SerenePortfolio from '@/themes/serene/portfolio';
import SereneTargeted from '@/themes/serene/targeted';

import { libreBaskerville, nunitoSans } from '@/themes/jade/fonts';
import JadePortfolio from '@/themes/jade/portfolio';
import JadeTargeted from '@/themes/jade/targeted';

import { inter as quartzInter, interBody as quartzInterBody } from '@/themes/quartz/fonts';
import QuartzPortfolio from '@/themes/quartz/portfolio';
import QuartzTargeted from '@/themes/quartz/targeted';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const data = loadPreviewData(id);
  const themeName = data.theme.name.toLowerCase();
  const isTargeted = data.siteType === 'targeted';

  switch (themeName) {
    case 'coral': {
      const fontClasses = `${poppins.variable} ${dmSans.variable}`;
      return <div className={fontClasses}>{isTargeted ? <CoralTargeted data={data} /> : <CoralPortfolio data={data} />}</div>;
    }
    case 'serene': {
      const fontClasses = `${sourceSerif.variable} ${sourceSans.variable}`;
      return <div className={fontClasses}>{isTargeted ? <SereneTargeted data={data} /> : <SerenePortfolio data={data} />}</div>;
    }
    case 'jade': {
      const fontClasses = `${libreBaskerville.variable} ${nunitoSans.variable}`;
      return <div className={fontClasses}>{isTargeted ? <JadeTargeted data={data} /> : <JadePortfolio data={data} />}</div>;
    }
    case 'quartz': {
      const fontClasses = `${quartzInter.variable} ${quartzInterBody.variable}`;
      return <div className={fontClasses}>{isTargeted ? <QuartzTargeted data={data} /> : <QuartzPortfolio data={data} />}</div>;
    }
    case 'onyx':
    default: {
      const fontClasses = `${jetbrainsMono.variable} ${onyxInter.variable}`;
      return <div className={fontClasses}>{isTargeted ? <OnyxTargeted data={data} /> : <OnyxPortfolio data={data} />}</div>;
    }
  }
}
```

Note: This page uses `async function` and `await params` because in Next.js 14+ with the App Router, `params` is a Promise in server components. The `loadPreviewData` call reads from the filesystem at render time (SSR).

- [ ] **Step 3: Verify generator builds in dev mode**

Run: `cd src-generator && npx next dev --port 3002` (start, verify no errors, then Ctrl-C)

- [ ] **Step 4: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-generator/app/preview/ src-generator/app/lib/loadPortfolioData.ts
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(generator): add preview route with per-ID data loading"
```

---

## Task 10: Frontend — Photo Upload UI

**Files:**
- Create: `src-ui/src/components/PhotoUpload.tsx`
- Modify: `src-ui/src/services/api.ts`
- Modify: `src-ui/src/types/api.ts`
- Modify: `src-ui/src/hooks/use-profile.ts`
- Modify: `src-ui/src/pages/profile.tsx`

- [ ] **Step 1: Add photo_path to ProfileResponse type**

In `src-ui/src/types/api.ts`, add to `ProfileResponse`:

```typescript
photo_path: string | null;
```

- [ ] **Step 2: Add photo API functions**

In `src-ui/src/services/api.ts`, add:

```typescript
export async function uploadPhoto(file: File): Promise<ProfileResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ProfileResponse>('/api/profile/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deletePhoto(): Promise<ProfileResponse> {
  const res = await api.delete<ProfileResponse>('/api/profile/photo');
  return res.data;
}
```

Also add the imports to the import block at the top if `ProfileResponse` isn't already imported there (it is — already used by `getProfile`).

- [ ] **Step 3: Add photo hooks**

In `src-ui/src/hooks/use-profile.ts`, add:

```typescript
import { uploadPhoto, deletePhoto } from '@/services/api';

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deletePhoto(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
```

Add `useMutation` and `useQueryClient` to the imports from `@tanstack/react-query` if not already there.

- [ ] **Step 4: Create PhotoUpload component**

Create `src-ui/src/components/PhotoUpload.tsx`:

```tsx
import { useCallback, useRef, useState } from 'react';
import { useUploadPhoto, useDeletePhoto } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Trash2, Loader2, User } from 'lucide-react';

interface PhotoUploadProps {
  photoPath: string | null;
}

export function PhotoUpload({ photoPath }: PhotoUploadProps) {
  const uploadMut = useUploadPhoto();
  const deleteMut = useDeletePhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const photoUrl = photoPath
    ? `${import.meta.env.VITE_API_URL || ''}/api/profile/photo/file`
    : null;

  const handleFile = useCallback(
    (file: File) => {
      setError('');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Please use a JPEG, PNG, or WebP image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be under 5 MB.');
        return;
      }
      uploadMut.mutate(file);
    },
    [uploadMut]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* Photo preview */}
          <div
            className={`relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                {uploadMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload Photo
              </Button>
              {photoPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP. Max 5 MB. Drag and drop or click to upload.
            </p>
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Add a photo file serving endpoint**

In `src-api/app/routers/profile.py`, add an endpoint to serve the photo file:

```python
from fastapi.responses import FileResponse

@router.get("/photo/file")
async def get_photo_file(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    profile = await profile_service.get_profile(db, user_id)
    if profile is None or not profile.photo_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo")

    from pathlib import Path
    full_path = Path(settings.upload_dir) / profile.photo_path
    if not full_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo file missing")

    return FileResponse(str(full_path))
```

Add `from app.config import settings` to the imports in profile.py if not already there.

- [ ] **Step 6: Add PhotoUpload to ProfilePage**

In `src-ui/src/pages/profile.tsx`, import and add the component:

```typescript
import { PhotoUpload } from '@/components/PhotoUpload';
```

In the main profile view (the return block after `const data = profile?.data;`), add right before the `{/* Basics */}` card:

```tsx
<PhotoUpload photoPath={profile?.photo_path ?? null} />
```

- [ ] **Step 7: Verify frontend builds**

Run: `cd src-ui && npm run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-ui/src/components/PhotoUpload.tsx src-ui/src/pages/profile.tsx src-ui/src/services/api.ts src-ui/src/types/api.ts src-ui/src/hooks/use-profile.ts src-api/app/routers/profile.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(ui): add profile photo upload with drag-and-drop"
```

---

## Task 11: Frontend — Theme Gallery and Preview

**Files:**
- Create: `src-ui/src/components/ThemeGallery.tsx`
- Create: `src-ui/src/components/PreviewModal.tsx`
- Create: `src-ui/src/hooks/use-preview.ts`
- Modify: `src-ui/src/services/api.ts`
- Modify: `src-ui/src/types/api.ts`
- Modify: `src-ui/src/pages/sites.tsx`

- [ ] **Step 1: Add preview types**

In `src-ui/src/types/api.ts`, add:

```typescript
export interface PreviewRequest {
  theme: string;
  site_type: string;
  job_posting_id?: string;
}

export interface PreviewResponse {
  preview_id: string;
}
```

- [ ] **Step 2: Add preview API functions**

In `src-ui/src/services/api.ts`, add:

```typescript
export async function createPreview(data: PreviewRequest): Promise<PreviewResponse> {
  const res = await api.post<PreviewResponse>('/api/preview', data);
  return res.data;
}

export async function deletePreview(previewId: string): Promise<void> {
  await api.delete(`/api/preview/${previewId}`);
}

export function getPreviewUrl(previewId: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const token = localStorage.getItem('authToken');
  return `${baseUrl}/api/preview/${previewId}?token=${token}`;
}
```

Import the new types at the top of the file.

- [ ] **Step 3: Create preview hooks**

Create `src-ui/src/hooks/use-preview.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import { createPreview, deletePreview } from '@/services/api';
import type { PreviewRequest } from '@/types/api';

export function useCreatePreview() {
  return useMutation({
    mutationFn: (data: PreviewRequest) => createPreview(data),
  });
}

export function useDeletePreview() {
  return useMutation({
    mutationFn: (previewId: string) => deletePreview(previewId),
  });
}
```

- [ ] **Step 4: Create ThemeGallery component**

Create `src-ui/src/components/ThemeGallery.tsx`:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

const THEMES = [
  {
    value: 'onyx',
    label: 'Onyx',
    description: 'Dark, technical, sharp edges',
    audience: 'Developers, engineers',
  },
  {
    value: 'coral',
    label: 'Coral',
    description: 'Warm, inviting, rounded',
    audience: 'Designers, creatives',
  },
  {
    value: 'serene',
    label: 'Serene',
    description: 'Clean, minimal, editorial',
    audience: 'Writers, consultants',
  },
  {
    value: 'jade',
    label: 'Jade',
    description: 'Classic, refined, traditional',
    audience: 'Executives, academics',
  },
  {
    value: 'quartz',
    label: 'Quartz',
    description: 'Modern, geometric, bold',
    audience: 'Product managers, marketers',
  },
];

interface ThemeGalleryProps {
  selected: string;
  onSelect: (theme: string) => void;
  variant?: 'portfolio' | 'targeted';
}

export function ThemeGallery({ selected, onSelect, variant = 'portfolio' }: ThemeGalleryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {THEMES.map((theme) => {
        const isSelected = selected === theme.value;
        const screenshotSrc = `/showcases/${theme.value}-${variant}.png`;

        return (
          <Card
            key={theme.value}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(theme.value)}
          >
            <CardContent className="p-0">
              {/* Screenshot */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-muted">
                <img
                  src={screenshotSrc}
                  alt={`${theme.label} theme`}
                  className="h-full w-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{theme.label}</h3>
                  <Badge variant="outline" className="text-xs">
                    {theme.audience}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{theme.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { THEMES };
```

- [ ] **Step 5: Create PreviewModal component**

Create `src-ui/src/components/PreviewModal.tsx`:

```tsx
import { useState } from 'react';
import { useCreatePreview } from '@/hooks/use-preview';
import { getPreviewUrl } from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Eye, ExternalLink } from 'lucide-react';

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: string;
  siteType: 'portfolio' | 'targeted';
  jobPostingId?: string;
  onGenerate: () => void;
}

export function PreviewModal({
  open,
  onOpenChange,
  theme,
  siteType,
  jobPostingId,
  onGenerate,
}: PreviewModalProps) {
  const createPreview = useCreatePreview();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await createPreview.mutateAsync({
        theme,
        site_type: siteType,
        job_posting_id: jobPostingId,
      });
      setPreviewId(result.preview_id);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreviewId(null);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {theme} ({siteType})
          </DialogTitle>
        </DialogHeader>

        {!previewId && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              Preview will render the {theme} theme with your actual profile data.
            </p>
            <Button onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Load Preview
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Rendering preview...</span>
          </div>
        )}

        {previewId && (
          <>
            <div className="flex-1 overflow-hidden rounded-md border">
              <iframe
                src={getPreviewUrl(previewId)}
                className="h-full w-full"
                title="Theme preview"
                onLoad={() => setLoading(false)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Back to Themes
              </Button>
              <Button onClick={() => { handleClose(); onGenerate(); }}>
                Generate Site
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Rewrite SitesPage with theme gallery + preview**

Rewrite `src-ui/src/pages/sites.tsx` to:
- Replace the theme `<Select>` dropdown in the portfolio dialog with `<ThemeGallery>`.
- Add a "Preview with my data" button that opens `<PreviewModal>`.
- Keep the existing sites table, generate targeted dialog, and delete dialog.
- The portfolio dialog now shows the theme gallery, a "Preview" button, and a "Generate" button.

The key changes to the portfolio dialog:
```tsx
<DialogContent className="max-w-3xl">
  <DialogHeader>
    <DialogTitle>Generate Portfolio Site</DialogTitle>
    <DialogDescription>Choose a theme for your portfolio.</DialogDescription>
  </DialogHeader>
  <ThemeGallery selected={selectedTheme} onSelect={setSelectedTheme} />
  <DialogFooter>
    <Button variant="outline" onClick={() => setShowPreview(true)}>
      <Eye className="mr-2 h-4 w-4" /> Preview
    </Button>
    <Button onClick={handleGeneratePortfolio} disabled={genPortfolio.isPending}>
      {genPortfolio.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Generate
    </Button>
  </DialogFooter>
</DialogContent>
```

Similarly update the targeted dialog to use `ThemeGallery`.

Add a `PreviewModal` that opens when "Preview" is clicked.

- [ ] **Step 7: Update preview API auth to support token query param**

The iframe can't send Authorization headers. In `src-api/app/routers/preview.py`, modify the `get_preview` endpoint to accept a `token` query parameter as an alternative to the header:

```python
from fastapi import Query

@router.get("/{preview_id}", response_class=HTMLResponse)
async def get_preview(
    preview_id: uuid.UUID,
    token: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
```

And update `get_current_user` in `src-api/app/middleware/auth.py` to also check for a `token` query parameter — or, simpler: bypass auth for preview GET (since the preview_id is a UUID that's unguessable and ephemeral). This is a design call. For simplicity, remove the `current_user` dependency from the GET endpoint since the preview ID serves as an access token.

- [ ] **Step 8: Verify frontend builds**

Run: `cd src-ui && npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-ui/src/components/ThemeGallery.tsx src-ui/src/components/PreviewModal.tsx src-ui/src/hooks/use-preview.ts src-ui/src/pages/sites.tsx src-ui/src/services/api.ts src-ui/src/types/api.ts src-api/app/routers/preview.py
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(ui): add theme gallery with live preview support"
```

---

## Task 12: Theme Showcase Sample Data

**Files:**
- Create: `src-generator/sample-data/showcase.json`

- [ ] **Step 1: Create sample portfolio data**

Create `src-generator/sample-data/showcase.json` with realistic fictional content that exercises all theme features. This should include:
- A full profile with name, title, summary, location
- Contact info with email, phone, website, LinkedIn
- 4-5 work experiences with titles, companies, bullets
- 3-4 projects with technologies and outcomes
- 2-3 education entries
- 5-6 skill categories
- 2-3 certifications
- 1-2 publications
- 1-2 awards
- 1-2 volunteer entries
- 2-3 languages

The data should represent a senior software engineer to make the themes look substantial. Set `hasResume: true` so the resume link renders.

```json
{
  "profile": {
    "fullName": "Alexandra Chen",
    "title": "Senior Software Engineer & Technical Lead",
    "summary": "Experienced software engineer with 12 years building scalable distributed systems...",
    "location": "San Francisco, CA"
  },
  "contact": { ... },
  "workExperience": [ ... ],
  "projects": [ ... ],
  ...
  "theme": { "name": "onyx" },
  "siteType": "portfolio",
  "hasResume": true
}
```

(Full content should be 100-150 lines of realistic JSON data.)

- [ ] **Step 2: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-generator/sample-data/showcase.json
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(generator): add sample portfolio data for theme showcase screenshots"
```

---

## Task 13: Generate Theme Showcase Screenshots

This is a manual task done after all theme code changes are complete. Screenshots need to be captured for each theme.

**Files:**
- Create: `src-ui/public/showcases/onyx-portfolio.png`
- Create: `src-ui/public/showcases/onyx-targeted.png`
- Create: `src-ui/public/showcases/coral-portfolio.png`
- Create: `src-ui/public/showcases/coral-targeted.png`
- Create: `src-ui/public/showcases/serene-portfolio.png`
- Create: `src-ui/public/showcases/serene-targeted.png`
- Create: `src-ui/public/showcases/jade-portfolio.png`
- Create: `src-ui/public/showcases/jade-targeted.png`
- Create: `src-ui/public/showcases/quartz-portfolio.png`
- Create: `src-ui/public/showcases/quartz-targeted.png`

- [ ] **Step 1: Create showcases directory**

```bash
mkdir -p src-ui/public/showcases
```

- [ ] **Step 2: Generate screenshots using the preview system**

For each theme:
1. Copy `src-generator/sample-data/showcase.json` to `src-generator/.data/portfolio-data.json`
2. Set the `theme.name` to the target theme
3. Run `cd src-generator && npx next dev --port 3002`
4. Open `http://localhost:3002` in a browser
5. Take a screenshot (1200x900 viewport recommended)
6. Save to `src-ui/public/showcases/{theme}-portfolio.png`
7. Update the JSON to set `siteType: "targeted"` and add a `jobPosting` object
8. Refresh and take the targeted screenshot

Optimize PNGs with `pngquant` or similar if available.

- [ ] **Step 3: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add src-ui/public/showcases/
git -C /Users/joemc3/tmp/professional-website-builder commit -m "feat(ui): add theme showcase screenshots for gallery"
```

---

## Task 14: Update CLAUDE.md and Docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-04-04-phase3e-polish-features-design.md` (add E2E phase note)

- [ ] **Step 1: Update CLAUDE.md**

Update the "Current Phase" section to reflect Phase 3e-A completion. Add the new endpoints to the API list:
- `POST /api/profile/photo` — Upload profile photo (JWT required)
- `DELETE /api/profile/photo` — Remove profile photo (JWT required)
- `GET /api/profile/photo/file` — Get profile photo file (JWT required)
- `POST /api/preview` — Start theme preview (JWT required)
- `GET /api/preview/:id` — Get rendered preview (unguessable ID)
- `DELETE /api/preview/:id` — Clean up preview data (JWT required)

Update the database tables list to note the `photo_path` column on profiles.

Update Common Commands if needed.

- [ ] **Step 2: Document Phase 4 (E2E) in superpowers docs**

Create or update a file at `docs/superpowers/specs/phase4-e2e-testing-scope.md`:

```markdown
# Phase 4: End-to-End Testing — Scope Notes

## Status: Planned (not started)

E2E testing was explicitly deferred from Phase 3e to keep that phase focused on features and deployment readiness.

## Planned Scope

- **Full pipeline tests**: upload document → parse → synthesize profile → generate site → verify static output
- **Cross-service integration**: API + worker + generator + Nginx serving
- **Resume pipeline**: generate resume → verify PDF → verify public URL
- **Preview pipeline**: request preview → verify SSR renders correctly
- **Automated Docker Compose smoke tests**: bring up all services, run health checks, exercise critical paths
- **Photo upload flow**: upload → verify resize → generate site → verify photo in output

## Technical Notes

- Consider `testcontainers` for full Docker Compose test orchestration
- Browser-based tests (Playwright/Cypress) for verifying generated site rendering
- API integration tests already exist in `src-api/tests/integration/` — E2E extends these to cross-service flows
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/joemc3/tmp/professional-website-builder add CLAUDE.md docs/superpowers/specs/phase4-e2e-testing-scope.md
git -C /Users/joemc3/tmp/professional-website-builder commit -m "docs: update CLAUDE.md for Phase 3e-A, document Phase 4 E2E scope"
```

---

## Dependency Graph

```
Task 1 (migration) ──→ Task 2 (photo service) ──→ Task 3 (photo endpoints)
                                                          │
Task 4 (hasResume + transform) ──→ Task 5 (photo copy) ──┤
                                          │               │
                                          ▼               ▼
                                   Task 6 (theme updates: resume link)
                                          │
                                          ▼
Task 7 (preview service) ──→ Task 8 (preview API) ──→ Task 9 (generator preview route)
                                                              │
                                                              ▼
Task 10 (photo UI) ──→ Task 11 (theme gallery + preview UI) ──→ Task 12 (showcase data)
                                                                        │
                                                                        ▼
                                                              Task 13 (screenshots)
                                                                        │
                                                                        ▼
                                                              Task 14 (docs)
```

**Parallelizable groups:**
- Tasks 1-3 (photo backend) can run in parallel with Tasks 4+7 (hasResume + preview service)
- Task 6 (theme updates) can start after Tasks 4 completes
- Tasks 10 and 9 can run in parallel after their dependencies
- Task 11 depends on 8, 9, 10
