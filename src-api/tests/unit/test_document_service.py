from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.document_service import FileTooLarge, UnsupportedFileType, upload_document


class TestUploadValidation:
    async def test_rejects_unsupported_file_type(self, tmp_path):
        file = MagicMock()
        file.content_type = "application/octet-stream"
        file.filename = "mystery.bin"
        db = AsyncMock()
        with pytest.raises(UnsupportedFileType):
            await upload_document(db, "550e8400-e29b-41d4-a716-446655440000", file, arq_pool=None, upload_dir=str(tmp_path))

    async def test_rejects_oversized_file(self, tmp_path):
        file = MagicMock()
        file.content_type = "text/markdown"
        file.filename = "huge.md"
        file.read = AsyncMock(return_value=b"x" * (11 * 1024 * 1024))
        db = AsyncMock()
        with pytest.raises(FileTooLarge):
            await upload_document(db, "550e8400-e29b-41d4-a716-446655440000", file, arq_pool=None, upload_dir=str(tmp_path), max_size_mb=10)

    async def test_accepts_valid_markdown(self, tmp_path):
        file = MagicMock()
        file.content_type = "text/markdown"
        file.filename = "resume.md"
        file.read = AsyncMock(return_value=b"# My Resume")
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        doc = await upload_document(db, "550e8400-e29b-41d4-a716-446655440000", file, arq_pool=None, upload_dir=str(tmp_path))
        assert doc.filename == "resume.md"
        assert doc.status == "processing"
        assert doc.file_size == 11
        db.add.assert_called_once()
        db.commit.assert_called_once()

    async def test_resolves_octet_stream_by_extension(self, tmp_path):
        file = MagicMock()
        file.content_type = "application/octet-stream"
        file.filename = "resume.md"
        file.read = AsyncMock(return_value=b"# My Resume")
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        doc = await upload_document(db, "550e8400-e29b-41d4-a716-446655440000", file, arq_pool=None, upload_dir=str(tmp_path))
        assert doc.content_type == "text/markdown"
