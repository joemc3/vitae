import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.user import User
from app.schemas.sites import PortfolioGenerateRequest, SiteResponse, TargetedGenerateRequest
from app.services import site_service

router = APIRouter(prefix="/api/sites", tags=["sites"])


def _to_response(site, stale: bool = False) -> SiteResponse:
    public_url = f"{settings.site_url}/{site.output_path}"
    return SiteResponse(
        id=str(site.id),
        slug=site.slug,
        type=site.type,
        theme=site.theme,
        status=site.status,
        error_message=site.error_message,
        output_path=site.output_path,
        public_url=public_url,
        stale=stale,
        job_posting_id=str(site.job_posting_id) if site.job_posting_id else None,
        generated_at=site.generated_at.isoformat() if site.generated_at else None,
        created_at=site.created_at.isoformat(),
        updated_at=site.updated_at.isoformat(),
    )


async def _get_user_and_profile(db: AsyncSession, user_id: uuid.UUID):
    """Load user and profile, raising if username or profile not set."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    if not user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set a username before generating sites.",
        )

    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Synthesize a profile before generating sites.",
        )

    return user, profile


@router.post("/portfolio", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def generate_portfolio(
    request: PortfolioGenerateRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    user, profile = await _get_user_and_profile(db, user_id)

    site = await site_service.create_portfolio_site(
        db=db,
        user_id=user_id,
        profile_id=profile.id,
        username=user.username,
        theme=request.theme,
    )

    # Enqueue generation job
    pool = req.app.state.arq_pool
    await pool.enqueue_job("generate_site_job", str(site.id))

    return _to_response(site)


@router.post("/targeted", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def generate_targeted(
    request: TargetedGenerateRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    user, profile = await _get_user_and_profile(db, user_id)

    site = await site_service.create_targeted_site(
        db=db,
        user_id=user_id,
        profile_id=profile.id,
        job_posting_id=request.job_posting_id,
        username=user.username,
        theme=request.theme,
    )

    pool = req.app.state.arq_pool
    await pool.enqueue_job("generate_site_job", str(site.id))

    return _to_response(site)


@router.get("/", response_model=list[SiteResponse])
async def list_sites(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    sites = await site_service.list_sites(db, user_id)

    # Check staleness for portfolio
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    responses = []
    for s in sites:
        stale = False
        if s.type == "portfolio" and profile:
            stale = site_service.is_portfolio_stale(profile.updated_at, s.generated_at)
        responses.append(_to_response(s, stale=stale))
    return responses


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    site = await site_service.get_site(db, site_id, user_id)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")

    stale = False
    if site.type == "portfolio":
        result = await db.execute(select(Profile).where(Profile.user_id == user_id))
        profile = result.scalar_one_or_none()
        if profile:
            stale = site_service.is_portfolio_stale(profile.updated_at, site.generated_at)

    return _to_response(site, stale=stale)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    site_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    try:
        output_path = await site_service.delete_site(db, site_id, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    # Clean up output files
    full_path = Path(settings.output_dir) / output_path
    if full_path.exists():
        shutil.rmtree(full_path)

    return None
