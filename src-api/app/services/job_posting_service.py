import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_posting import JobPosting


async def create_job_posting(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    company: str,
    description: str,
    source_url: str | None = None,
    raw_text: str | None = None,
    requirements: dict | None = None,
) -> JobPosting:
    posting = JobPosting(
        user_id=user_id,
        title=title,
        company=company,
        description=description,
        source_url=source_url,
        raw_text=raw_text,
        requirements=requirements,
    )
    db.add(posting)
    await db.commit()
    await db.refresh(posting)
    return posting


async def get_job_posting(
    db: AsyncSession, posting_id: uuid.UUID, user_id: uuid.UUID
) -> JobPosting | None:
    result = await db.execute(
        select(JobPosting).where(
            JobPosting.id == posting_id, JobPosting.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def list_job_postings(
    db: AsyncSession, user_id: uuid.UUID
) -> list[JobPosting]:
    result = await db.execute(
        select(JobPosting)
        .where(JobPosting.user_id == user_id)
        .order_by(JobPosting.created_at.desc())
    )
    return result.scalars().all()


async def update_job_posting(
    db: AsyncSession,
    posting_id: uuid.UUID,
    user_id: uuid.UUID,
    **fields,
) -> JobPosting | None:
    posting = await get_job_posting(db, posting_id, user_id)
    if posting is None:
        return None

    for key, value in fields.items():
        if value is not None:
            setattr(posting, key, value)

    await db.commit()
    await db.refresh(posting)
    return posting


async def delete_job_posting(
    db: AsyncSession, posting_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    posting = await get_job_posting(db, posting_id, user_id)
    if posting is None:
        return False

    await db.delete(posting)
    await db.commit()
    return True
