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
