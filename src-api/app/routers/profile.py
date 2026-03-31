import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.profile import ProfileData, ProfileResponse, SynthesizeRequest
from app.services import profile_service
from app.services.profile_synthesizer import synthesize_profile

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    profile = await profile_service.get_profile(db, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile exists")
    return ProfileResponse(
        id=str(profile.id),
        data=ProfileData(**profile.data),
        guidance=profile.guidance,
        generated_at=profile.generated_at.isoformat() if profile.generated_at else None,
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.put("/", response_model=ProfileResponse)
async def update_profile_endpoint(
    data: ProfileData,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    profile = await profile_service.update_profile(db, user_id, data.model_dump(exclude_none=True))
    return ProfileResponse(
        id=str(profile.id),
        data=ProfileData(**profile.data),
        guidance=profile.guidance,
        generated_at=profile.generated_at.isoformat() if profile.generated_at else None,
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.patch("/", response_model=ProfileResponse)
async def patch_profile_endpoint(
    data: ProfileData,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])
    try:
        profile = await profile_service.patch_profile(db, user_id, data.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ProfileResponse(
        id=str(profile.id),
        data=ProfileData(**profile.data),
        guidance=profile.guidance,
        generated_at=profile.generated_at.isoformat() if profile.generated_at else None,
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.post("/synthesize")
async def synthesize_profile_endpoint(
    request: SynthesizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"])

    async def event_stream():
        try:
            # Status: analyzing
            yield _sse_event("status", {"message": "Analyzing documents..."})

            # Status: synthesizing
            yield _sse_event("status", {"message": "Synthesizing profile..."})

            # Run synthesis
            profile_data, profile = await synthesize_profile(
                db=db,
                user_id=user_id,
                model=request.model,
                guidance=request.guidance,
            )

            # Status: processing
            yield _sse_event("status", {"message": "Processing response..."})

            # Emit non-empty sections
            profile_dict = profile_data.model_dump(exclude_none=True)
            for section_name, section_content in profile_dict.items():
                yield _sse_event("section", {"section": section_name, "content": section_content})

            # Complete
            yield _sse_event("complete", {"profile_id": str(profile.id)})

        except ValueError as e:
            yield _sse_event("error", {"message": str(e)})
        except Exception as e:
            yield _sse_event("error", {"message": f"Synthesis failed: {str(e)}"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
