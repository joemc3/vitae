import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document
from app.services.document_parser import ALLOWED_CONTENT_TYPES, resolve_content_type


class UnsupportedFileType(Exception):
    pass


class FileTooLarge(Exception):
    pass


async def upload_document(
    db: AsyncSession,
    user_id: str,
    file: UploadFile,
    arq_pool,
    upload_dir: str | None = None,
    max_size_mb: int | None = None,
) -> Document:
    upload_dir = upload_dir or settings.upload_dir
    max_size_mb = max_size_mb or settings.max_upload_size_mb

    content_type = resolve_content_type(file.filename or "", file.content_type or "")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedFileType(f"Unsupported file type: {file.content_type} ({file.filename})")

    content = await file.read()
    max_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise FileTooLarge(f"File too large: {len(content)} bytes (max {max_bytes})")

    doc_id = uuid.uuid4()
    ext = ALLOWED_CONTENT_TYPES[content_type]
    relative_path = f"{user_id}/{doc_id}{ext}"
    full_path = Path(upload_dir) / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)

    document = Document(
        id=doc_id,
        user_id=uuid.UUID(user_id),
        filename=file.filename or "untitled",
        content_type=content_type,
        file_path=relative_path,
        file_size=len(content),
        status="processing",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    if arq_pool is not None:
        await arq_pool.enqueue_job("parse_document_job", str(doc_id))

    return document


async def list_documents(
    db: AsyncSession,
    user_id: str,
    status_filter: str | None = None,
) -> list[Document]:
    query = select(Document).where(Document.user_id == uuid.UUID(user_id))
    if status_filter:
        query = query.where(Document.status == status_filter)
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_document(
    db: AsyncSession,
    user_id: str,
    doc_id: str,
) -> Document | None:
    result = await db.execute(
        select(Document).where(
            Document.id == uuid.UUID(doc_id),
            Document.user_id == uuid.UUID(user_id),
        )
    )
    return result.scalar_one_or_none()


async def delete_document(
    db: AsyncSession,
    user_id: str,
    doc_id: str,
    upload_dir: str | None = None,
) -> bool:
    upload_dir = upload_dir or settings.upload_dir
    document = await get_document(db, user_id, doc_id)
    if document is None:
        return False

    full_path = Path(upload_dir) / document.file_path
    if full_path.exists():
        full_path.unlink()

    await db.delete(document)
    await db.commit()
    return True
