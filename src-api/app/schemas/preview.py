import uuid

from pydantic import BaseModel


class PreviewRequest(BaseModel):
    theme: str
    site_type: str = "portfolio"
    job_posting_id: uuid.UUID | None = None


class PreviewResponse(BaseModel):
    preview_id: str
