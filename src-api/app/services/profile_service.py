import copy
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile


# Sections where the value is a dict (merged key-by-key on patch)
DICT_SECTIONS = {"basics"}


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile | None:
    result = await db.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_profile(db: AsyncSession, user_id: uuid.UUID, data: dict) -> Profile:
    profile = await get_profile(db, user_id)
    if profile is None:
        profile = Profile(user_id=user_id, data=data)
        db.add(profile)
    else:
        profile.data = data
    await db.commit()
    await db.refresh(profile)
    return profile


async def patch_profile(db: AsyncSession, user_id: uuid.UUID, patch: dict) -> Profile:
    profile = await get_profile(db, user_id)
    if profile is None:
        raise ValueError("No profile exists to patch")

    merged = copy.deepcopy(profile.data)

    for key, value in patch.items():
        if key in DICT_SECTIONS and key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value

    profile.data = merged
    await db.commit()
    await db.refresh(profile)
    return profile
