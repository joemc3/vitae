import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    file_size: int
    status: str
    error_message: str | None
    parsed_text: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
