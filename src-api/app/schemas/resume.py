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
