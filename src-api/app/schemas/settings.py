from pydantic import BaseModel


class APIKeySaveRequest(BaseModel):
    provider: str
    api_key: str


class APIKeySaveResponse(BaseModel):
    provider: str
    saved: bool


class APIKeyStatusResponse(BaseModel):
    provider: str
    is_set: bool
    selected_model: str | None = None


class ModelInfo(BaseModel):
    id: str
    name: str | None = None


class ModelListResponse(BaseModel):
    provider: str
    models: list[ModelInfo]


class ModelSelectRequest(BaseModel):
    model: str


class TestConnectionRequest(BaseModel):
    provider: str
    model: str | None = None


class TestConnectionResponse(BaseModel):
    provider: str
    status: str
    message: str | None = None
