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
        photo_url = "/api/profile/photo/file"

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
async def get_preview(preview_id: uuid.UUID):
    """Proxy the rendered preview page from the generator dev server.

    No auth required — the preview_id is an unguessable UUID that serves as an access token.
    This allows the admin UI to load the preview in an iframe without auth header complications.
    """
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
