from pydantic import BaseModel


class JobPostingCreate(BaseModel):
    title: str
    company: str
    description: str
    source_url: str | None = None
    raw_text: str | None = None
    requirements: dict | None = None


class JobPostingUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    description: str | None = None
    source_url: str | None = None
    raw_text: str | None = None
    requirements: dict | None = None


class JobPostingResponse(BaseModel):
    id: str
    title: str
    company: str
    description: str
    source_url: str | None
    raw_text: str | None
    requirements: dict | None
    created_at: str
    updated_at: str


class JobPostingDraft(BaseModel):
    """Returned by from-url and from-text endpoints. Not persisted."""
    title: str
    company: str
    description: str
    source_url: str | None = None
    raw_text: str | None = None
    requirements: dict | None = None


class ScrapeRequest(BaseModel):
    url: str


class ParseRequest(BaseModel):
    raw_text: str
