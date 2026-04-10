# Phase 2a: Document Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the document repository — upload, parse, store, and manage professional documents — plus encrypted API key storage for LLM providers.

**Architecture:** FastAPI API receives uploads, saves files to a Docker volume, enqueues parsing jobs via ARQ (Redis-backed async queue). A separate worker process parses documents and updates the database. API key encryption uses AES-256-GCM with HKDF-derived keys.

**Tech Stack:** FastAPI, SQLAlchemy async, ARQ, Redis, pymupdf, python-docx, openpyxl, python-pptx, cryptography

---

## File Map

### New Files
```
src-api/
├── app/
│   ├── models/document.py          — Document ORM model
│   ├── models/api_key.py           — APIKey ORM model
│   ├── routers/documents.py        — Document CRUD endpoints
│   ├── routers/settings.py         — API key management endpoints
│   ├── schemas/documents.py        — Document Pydantic schemas
│   ├── schemas/settings.py         — API key Pydantic schemas
│   ├── services/document_parser.py — Format-specific parsing (5 formats)
│   ├── services/document_service.py— Document business logic
│   ├── services/encryption_service.py — AES-256-GCM encrypt/decrypt
│   └── worker.py                   — ARQ worker settings + parse job
├── migrations/versions/
│   ├── 002_documents.py            — Documents table migration
│   └── 003_api_keys.py             — API keys table migration
└── tests/
    ├── fixtures/
    │   ├── __init__.py
    │   ├── sample.md               — Markdown test fixture
    │   └── generate_fixtures.py    — Script to generate binary fixtures
    ├── unit/
    │   ├── test_document_parser.py
    │   ├── test_encryption_service.py
    │   └── test_document_service.py
    └── integration/
        ├── test_document_flow.py
        └── test_api_keys.py
```

### Modified Files
```
src-api/app/config.py              — Add redis_url, upload_dir, max_upload_size_mb, secret_key, ollama_url
src-api/app/models/__init__.py     — Export Document, APIKey
src-api/app/models/user.py         — Add documents relationship
src-api/app/main.py                — ARQ pool in lifespan, register new routers
src-api/pyproject.toml             — Add 8 new dependencies
docker-compose.yml                 — Add redis, worker services, uploads volume
.env.example                       — Add REDIS_URL, UPLOAD_DIR, MAX_UPLOAD_SIZE_MB
.gitignore                         — Add uploads/
README.md                          — Update with Phase 2a capabilities
CLAUDE.md                          — Update with new endpoints, models, commands
```

---

### Task 1: Add Dependencies and Update Configuration

**Files:**
- Modify: `src-api/pyproject.toml`
- Modify: `src-api/app/config.py`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add production dependencies to pyproject.toml**

Add these to the `dependencies` list in `src-api/pyproject.toml`:

```toml
    "arq>=0.26.0",
    "cryptography>=44.0.0",
    "markdown>=3.7",
    "beautifulsoup4>=4.12.0",
    "python-docx>=1.1.0",
    "pymupdf>=1.25.0",
    "openpyxl>=3.1.0",
    "python-pptx>=1.0.0",
```

- [ ] **Step 2: Lock dependencies**

Run: `cd src-api && uv lock`

- [ ] **Step 3: Add new settings to config.py**

Add these fields to the `Settings` class in `src-api/app/config.py`, after the existing `log_level` field:

```python
    # Encryption
    secret_key: str = "change-me-in-production"

    # Redis (ARQ job queue)
    redis_url: str = "redis://redis:6379"

    # File uploads
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10

    # Ollama
    ollama_url: str = "http://localhost:11434"
```

- [ ] **Step 4: Update .env.example**

Add after the `OLLAMA_URL` entry in `.env.example`:

```bash
# --- Redis (background job queue) ---
REDIS_URL=redis://redis:6379

# --- File uploads ---
# Base directory for uploaded documents
UPLOAD_DIR=uploads
# Maximum upload size in MB
MAX_UPLOAD_SIZE_MB=10
```

- [ ] **Step 5: Update .gitignore**

Add after the `user-data/` entry in `.gitignore`:

```
# Uploaded documents (runtime data)
uploads/
```

- [ ] **Step 6: Verify dependencies install**

Run: `cd src-api && uv sync`
Expected: all packages install successfully

- [ ] **Step 7: Commit**

```bash
git add src-api/pyproject.toml src-api/uv.lock src-api/app/config.py .env.example .gitignore
git commit -m "Add Phase 2a dependencies and configuration"
```

---

### Task 2: Document and API Key Models + Migrations

**Files:**
- Create: `src-api/app/models/document.py`
- Create: `src-api/app/models/api_key.py`
- Modify: `src-api/app/models/user.py`
- Modify: `src-api/app/models/__init__.py`
- Create: `src-api/migrations/versions/002_documents.py`
- Create: `src-api/migrations/versions/003_api_keys.py`

- [ ] **Step 1: Create Document model**

Create `src-api/app/models/document.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.user import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="documents")
```

- [ ] **Step 2: Create APIKey model**

Create `src-api/app/models/api_key.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class APIKey(Base):
    __tablename__ = "api_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_api_keys_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    encrypted_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 3: Add documents relationship to User model**

Add this import and relationship to `src-api/app/models/user.py`. Add `relationship` to the imports from `sqlalchemy.orm`, and add the relationship field after `updated_at`:

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
```

```python
    documents: Mapped[list["Document"]] = relationship(back_populates="user")
```

- [ ] **Step 4: Update models __init__.py**

Replace `src-api/app/models/__init__.py` with:

```python
from app.models.user import Base, User
from app.models.document import Document
from app.models.api_key import APIKey

__all__ = ["Base", "User", "Document", "APIKey"]
```

- [ ] **Step 5: Create documents migration**

Create `src-api/migrations/versions/002_documents.py`:

```python
"""Create documents table

Revision ID: 002
Revises: 001
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("parsed_text", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_user_id", "documents", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_user_id", table_name="documents")
    op.drop_table("documents")
```

- [ ] **Step 6: Create api_keys migration**

Create `src-api/migrations/versions/003_api_keys.py`:

```python
"""Create api_keys table

Revision ID: 003
Revises: 002
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("encrypted_key", sa.LargeBinary, nullable=False),
        sa.Column("nonce", sa.LargeBinary, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_unique_constraint("uq_api_keys_user_provider", "api_keys", ["user_id", "provider"])


def downgrade() -> None:
    op.drop_constraint("uq_api_keys_user_provider", "api_keys", type_="unique")
    op.drop_index("ix_api_keys_user_id", table_name="api_keys")
    op.drop_table("api_keys")
```

- [ ] **Step 7: Verify existing tests still pass**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: all 8 existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src-api/app/models/ src-api/migrations/versions/002_documents.py src-api/migrations/versions/003_api_keys.py
git commit -m "Add Document and APIKey models with migrations"
```

---

### Task 3: Encryption Service (TDD)

**Files:**
- Create: `src-api/tests/unit/test_encryption_service.py`
- Create: `src-api/app/services/encryption_service.py`

- [ ] **Step 1: Write failing tests**

Create `src-api/tests/unit/test_encryption_service.py`:

```python
import os

import pytest

from app.services.encryption_service import decrypt, encrypt


class TestEncryptDecrypt:
    def test_roundtrip(self):
        plaintext = "sk-ant-api03-test-key-abc123"
        ciphertext, nonce = encrypt(plaintext)
        result = decrypt(ciphertext, nonce)
        assert result == plaintext

    def test_returns_bytes(self):
        ciphertext, nonce = encrypt("test-key")
        assert isinstance(ciphertext, bytes)
        assert isinstance(nonce, bytes)
        assert len(nonce) == 12

    def test_different_calls_produce_different_nonces(self):
        _, nonce1 = encrypt("same-key")
        _, nonce2 = encrypt("same-key")
        assert nonce1 != nonce2

    def test_wrong_nonce_fails(self):
        ciphertext, _ = encrypt("test-key")
        wrong_nonce = os.urandom(12)
        with pytest.raises(Exception):
            decrypt(ciphertext, wrong_nonce)

    def test_tampered_ciphertext_fails(self):
        ciphertext, nonce = encrypt("test-key")
        tampered = ciphertext[:-1] + bytes([ciphertext[-1] ^ 0xFF])
        with pytest.raises(Exception):
            decrypt(tampered, nonce)

    def test_empty_string_roundtrip(self):
        ciphertext, nonce = encrypt("")
        assert decrypt(ciphertext, nonce) == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_encryption_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.encryption_service'`

- [ ] **Step 3: Implement encryption service**

Create `src-api/app/services/encryption_service.py`:

```python
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.config import settings


def _derive_key() -> bytes:
    hkdf = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"vitae-static-salt",
        info=b"api-key-encryption",
    )
    return hkdf.derive(settings.secret_key.encode("utf-8"))


def encrypt(plaintext: str) -> tuple[bytes, bytes]:
    key = _derive_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return ciphertext, nonce


def decrypt(ciphertext: bytes, nonce: bytes) -> str:
    key = _derive_key()
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_encryption_service.py -v`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-api/tests/unit/test_encryption_service.py src-api/app/services/encryption_service.py
git commit -m "Add encryption service with AES-256-GCM (TDD)"
```

---

### Task 4: Test Fixtures for Document Parsers

**Files:**
- Create: `src-api/tests/fixtures/__init__.py`
- Create: `src-api/tests/fixtures/sample.md`
- Create: `src-api/tests/fixtures/generate_fixtures.py`

- [ ] **Step 1: Create fixtures directory and __init__.py**

Create empty `src-api/tests/fixtures/__init__.py`.

- [ ] **Step 2: Create Markdown fixture**

Create `src-api/tests/fixtures/sample.md`:

```markdown
# John Doe

## Senior Software Engineer

Experienced professional with expertise in Python, FastAPI, and cloud infrastructure.

### Skills

- Python
- FastAPI
- PostgreSQL
- Docker

### Experience

**Acme Corp** — Senior Software Engineer (2020-2024)

Built microservices architecture serving 1M requests per day. Led team of 5 engineers.
```

- [ ] **Step 3: Create fixture generation script**

Create `src-api/tests/fixtures/generate_fixtures.py`:

```python
"""Generate binary test fixture files for document parser tests.

Run once from src-api/:
    uv run python tests/fixtures/generate_fixtures.py
"""
from pathlib import Path

HERE = Path(__file__).parent

NAME = "John Doe"
TITLE = "Senior Software Engineer"
SUMMARY = "Experienced professional with expertise in Python, FastAPI, and cloud infrastructure."
SKILLS = ["Python", "FastAPI", "PostgreSQL", "Docker"]
COMPANY = "Acme Corp"


def generate_docx():
    from docx import Document

    doc = Document()
    doc.add_heading(NAME, level=1)
    doc.add_heading(TITLE, level=2)
    doc.add_paragraph(SUMMARY)
    doc.add_heading("Skills", level=3)
    for skill in SKILLS:
        doc.add_paragraph(skill, style="List Bullet")
    doc.add_heading("Experience", level=3)
    doc.add_paragraph(f"{COMPANY} — {TITLE} (2020-2024)")
    doc.save(HERE / "sample.docx")
    print("Generated sample.docx")


def generate_pdf():
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    text = f"{NAME}\n{TITLE}\n\n{SUMMARY}\n\nSkills: {', '.join(SKILLS)}\n\n{COMPANY} — {TITLE} (2020-2024)"
    page.insert_text((72, 72), text, fontsize=12)
    doc.save(str(HERE / "sample.pdf"))
    doc.close()
    print("Generated sample.pdf")


def generate_xlsx():
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Resume"
    ws["A1"] = "Name"
    ws["B1"] = NAME
    ws["A2"] = "Title"
    ws["B2"] = TITLE
    ws["A3"] = "Summary"
    ws["B3"] = SUMMARY
    ws["A4"] = "Skills"
    ws["B4"] = ", ".join(SKILLS)
    ws["A5"] = "Company"
    ws["B5"] = COMPANY
    wb.save(HERE / "sample.xlsx")
    print("Generated sample.xlsx")


def generate_pptx():
    from pptx import Presentation
    from pptx.util import Inches

    prs = Presentation()
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    txBox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(5))
    tf = txBox.text_frame
    tf.text = f"{NAME}\n{TITLE}\n{SUMMARY}\nSkills: {', '.join(SKILLS)}\n{COMPANY}"
    prs.save(HERE / "sample.pptx")
    print("Generated sample.pptx")


if __name__ == "__main__":
    generate_docx()
    generate_pdf()
    generate_xlsx()
    generate_pptx()
    print("All fixtures generated.")
```

- [ ] **Step 4: Generate binary fixtures**

Run: `cd src-api && uv run python tests/fixtures/generate_fixtures.py`
Expected: "All fixtures generated." — four new files in `tests/fixtures/`

- [ ] **Step 5: Verify fixtures exist**

Run: `ls -la src-api/tests/fixtures/`
Expected: `sample.md`, `sample.docx`, `sample.pdf`, `sample.xlsx`, `sample.pptx`, `generate_fixtures.py`, `__init__.py`

- [ ] **Step 6: Commit**

```bash
git add src-api/tests/fixtures/
git commit -m "Add test fixture files for document parser tests"
```

---

### Task 5: Document Parser (TDD)

**Files:**
- Create: `src-api/tests/unit/test_document_parser.py`
- Create: `src-api/app/services/document_parser.py`

- [ ] **Step 1: Write failing tests**

Create `src-api/tests/unit/test_document_parser.py`:

```python
from pathlib import Path

import pytest

from app.services.document_parser import ALLOWED_CONTENT_TYPES, parse_document

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


class TestParseMarkdown:
    def test_extracts_text(self):
        result = parse_document(str(FIXTURES_DIR / "sample.md"), "text/markdown")
        assert "John Doe" in result
        assert "Senior Software Engineer" in result
        assert "Python" in result
        assert "Acme Corp" in result

    def test_strips_markdown_formatting(self):
        result = parse_document(str(FIXTURES_DIR / "sample.md"), "text/markdown")
        assert "###" not in result
        assert "**" not in result


class TestParseDocx:
    def test_extracts_text(self):
        result = parse_document(
            str(FIXTURES_DIR / "sample.docx"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        assert "John Doe" in result
        assert "Senior Software Engineer" in result
        assert "Python" in result
        assert "Acme Corp" in result


class TestParsePdf:
    def test_extracts_text(self):
        result = parse_document(str(FIXTURES_DIR / "sample.pdf"), "application/pdf")
        assert "John Doe" in result
        assert "Senior Software Engineer" in result
        assert "Python" in result


class TestParseXlsx:
    def test_extracts_text(self):
        result = parse_document(
            str(FIXTURES_DIR / "sample.xlsx"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        assert "John Doe" in result
        assert "Senior Software Engineer" in result


class TestParsePptx:
    def test_extracts_text(self):
        result = parse_document(
            str(FIXTURES_DIR / "sample.pptx"),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
        assert "John Doe" in result
        assert "Senior Software Engineer" in result


class TestDispatcher:
    def test_unsupported_content_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported content type"):
            parse_document("/fake/path.bin", "application/octet-stream")

    def test_allowed_content_types_has_all_formats(self):
        assert "text/markdown" in ALLOWED_CONTENT_TYPES
        assert "application/pdf" in ALLOWED_CONTENT_TYPES
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in ALLOWED_CONTENT_TYPES
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in ALLOWED_CONTENT_TYPES
        assert "application/vnd.openxmlformats-officedocument.presentationml.presentation" in ALLOWED_CONTENT_TYPES
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_document_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.document_parser'`

- [ ] **Step 3: Implement document parser**

Create `src-api/app/services/document_parser.py`:

```python
from pathlib import Path

import markdown
from bs4 import BeautifulSoup

ALLOWED_CONTENT_TYPES = {
    "text/markdown": ".md",
    "text/x-markdown": ".md",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}

EXTENSION_TO_CONTENT_TYPE = {v: k for k, v in ALLOWED_CONTENT_TYPES.items() if k != "text/x-markdown"}


def resolve_content_type(filename: str, declared_content_type: str) -> str:
    """Resolve content type from filename extension if declared type is generic."""
    if declared_content_type not in ("application/octet-stream", ""):
        return declared_content_type
    ext = Path(filename).suffix.lower()
    return EXTENSION_TO_CONTENT_TYPE.get(ext, declared_content_type)


def parse_document(file_path: str, content_type: str) -> str:
    """Parse a document and return extracted plain text."""
    parsers = {
        "text/markdown": _parse_markdown,
        "text/x-markdown": _parse_markdown,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": _parse_docx,
        "application/pdf": _parse_pdf,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": _parse_xlsx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": _parse_pptx,
    }
    parser = parsers.get(content_type)
    if parser is None:
        raise ValueError(f"Unsupported content type: {content_type}")
    return parser(file_path)


def _parse_markdown(file_path: str) -> str:
    text = Path(file_path).read_text(encoding="utf-8")
    html = markdown.markdown(text)
    return BeautifulSoup(html, "html.parser").get_text(separator="\n").strip()


def _parse_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text.strip())
    for table in doc.tables:
        for row in table.rows:
            row_text = "\t".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                parts.append(row_text)
    return "\n".join(parts)


def _parse_pdf(file_path: str) -> str:
    import fitz

    doc = fitz.open(file_path)
    parts = []
    for page in doc:
        text = page.get_text().strip()
        if text:
            parts.append(text)
    doc.close()
    return "\n\n".join(parts)


def _parse_xlsx(file_path: str) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(file_path, read_only=True, data_only=True)
    parts = []
    for sheet in wb:
        for row in sheet.iter_rows(values_only=True):
            row_text = "\t".join(str(cell) for cell in row if cell is not None)
            if row_text.strip():
                parts.append(row_text)
    wb.close()
    return "\n".join(parts)


def _parse_pptx(file_path: str) -> str:
    from pptx import Presentation

    prs = Presentation(file_path)
    parts = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    if para.text.strip():
                        parts.append(para.text.strip())
    return "\n".join(parts)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_document_parser.py -v`
Expected: all 9 tests PASS

- [ ] **Step 5: Run all unit tests**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: all tests PASS (8 existing + 6 encryption + 9 parser = 23)

- [ ] **Step 6: Commit**

```bash
git add src-api/tests/unit/test_document_parser.py src-api/app/services/document_parser.py
git commit -m "Add document parser for 5 formats (TDD)"
```

---

### Task 6: ARQ Worker Infrastructure

**Files:**
- Create: `src-api/app/worker.py`
- Modify: `src-api/app/main.py`

- [ ] **Step 1: Create worker module**

Create `src-api/app/worker.py`:

```python
import asyncio
import logging
import uuid
from urllib.parse import urlparse

from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.document import Document
from app.services.document_parser import parse_document

logger = logging.getLogger(__name__)


def get_redis_settings() -> RedisSettings:
    parsed = urlparse(settings.redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
    )


async def startup(ctx):
    engine = create_async_engine(settings.database_url)
    ctx["session_factory"] = async_sessionmaker(engine, expire_on_commit=False)
    logger.info("Worker started")


async def shutdown(ctx):
    if "session_factory" in ctx:
        engine = ctx["session_factory"].kw.get("bind")
        if engine:
            await engine.dispose()
    logger.info("Worker shut down")


async def parse_document_job(ctx, doc_id: str):
    session_factory = ctx["session_factory"]
    async with session_factory() as session:
        result = await session.execute(
            select(Document).where(Document.id == uuid.UUID(doc_id))
        )
        document = result.scalar_one_or_none()
        if document is None:
            logger.error(f"Document {doc_id} not found")
            return

        try:
            from pathlib import Path

            full_path = str(Path(settings.upload_dir) / document.file_path)
            parsed_text = await asyncio.to_thread(parse_document, full_path, document.content_type)
            document.parsed_text = parsed_text
            document.status = "completed"
            logger.info(f"Parsed document {doc_id}: {len(parsed_text)} chars")
        except Exception as e:
            logger.error(f"Failed to parse document {doc_id}: {e}")
            document.status = "failed"
            document.error_message = str(e)

        await session.commit()


class WorkerSettings:
    functions = [parse_document_job]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = get_redis_settings()
```

- [ ] **Step 2: Update main.py lifespan to create ARQ pool**

Modify `src-api/app/main.py`. Add the ARQ pool setup to the lifespan, after the migration block. Add the import at the top. The full updated file:

```python
import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.routers import auth

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run Alembic migrations on startup
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error(f"Migration failed: {result.stderr}")
    else:
        logger.info("Database migrations applied successfully")

    # Create ARQ Redis pool
    app.state.arq_pool = None
    try:
        from arq import create_pool

        from app.worker import get_redis_settings

        app.state.arq_pool = await create_pool(get_redis_settings())
        logger.info("ARQ pool connected to Redis")
    except Exception as e:
        logger.warning(f"Redis not available — background jobs disabled: {e}")

    yield

    # Cleanup
    if app.state.arq_pool is not None:
        await app.state.arq_pool.close()


app = FastAPI(
    title="Vitae API",
    version="0.2.0",
    lifespan=lifespan,
)

allowed_origins = [settings.admin_url]
if settings.cors_origins:
    allowed_origins.extend(settings.cors_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
async def health_check():
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: all 23 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src-api/app/worker.py src-api/app/main.py
git commit -m "Add ARQ worker infrastructure with graceful Redis fallback"
```

---

### Task 7: Document Schemas and Service (TDD)

**Files:**
- Create: `src-api/app/schemas/documents.py`
- Create: `src-api/tests/unit/test_document_service.py`
- Create: `src-api/app/services/document_service.py`

- [ ] **Step 1: Create document schemas**

Create `src-api/app/schemas/documents.py`:

```python
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    status: str
    error_message: str | None
    parsed_text: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write failing tests for document service**

Create `src-api/tests/unit/test_document_service.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_document_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.document_service'`

- [ ] **Step 4: Implement document service**

Create `src-api/app/services/document_service.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_document_service.py -v`
Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-api/app/schemas/documents.py src-api/app/services/document_service.py src-api/tests/unit/test_document_service.py
git commit -m "Add document service with upload validation (TDD)"
```

---

### Task 8: Document Router

**Files:**
- Create: `src-api/app/routers/documents.py`
- Modify: `src-api/app/main.py`

- [ ] **Step 1: Create document router**

Create `src-api/app/routers/documents.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.documents import DocumentResponse
from app.services.document_service import (
    FileTooLarge,
    UnsupportedFileType,
    delete_document,
    get_document,
    list_documents,
    upload_document,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/", response_model=list[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    request: Request,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    results = []
    for file in files:
        try:
            doc = await upload_document(
                db=db,
                user_id=current_user["id"],
                file=file,
                arq_pool=getattr(request.app.state, "arq_pool", None),
            )
            results.append(doc)
        except UnsupportedFileType as e:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=str(e),
            )
        except FileTooLarge as e:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=str(e),
            )
    return results


@router.get("/", response_model=list[DocumentResponse])
async def list_all_documents(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await list_documents(db, current_user["id"], status_filter)


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_single_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    document = await get_document(db, current_user["id"], doc_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_single_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    deleted = await delete_document(db, current_user["id"], doc_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return None
```

- [ ] **Step 2: Register document router in main.py**

Add this import and router registration to `src-api/app/main.py`. Add to imports:

```python
from app.routers import auth, documents
```

Add after `app.include_router(auth.router)`:

```python
app.include_router(documents.router)
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: all 27 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src-api/app/routers/documents.py src-api/app/main.py
git commit -m "Add document CRUD endpoints"
```

---

### Task 9: Settings Schemas and Router (TDD)

**Files:**
- Create: `src-api/app/schemas/settings.py`
- Create: `src-api/app/routers/settings.py`
- Modify: `src-api/app/main.py`

- [ ] **Step 1: Create settings schemas**

Create `src-api/app/schemas/settings.py`:

```python
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


class TestConnectionRequest(BaseModel):
    provider: str


class TestConnectionResponse(BaseModel):
    provider: str
    status: str
    message: str | None = None
```

- [ ] **Step 2: Create settings router**

Create `src-api/app/routers/settings.py`:

```python
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.api_key import APIKey
from app.schemas.settings import (
    APIKeySaveRequest,
    APIKeySaveResponse,
    APIKeyStatusResponse,
    TestConnectionRequest,
    TestConnectionResponse,
)
from app.services.encryption_service import decrypt, encrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_PROVIDERS = {"anthropic", "openai", "gemini", "openrouter"}
TEST_URLS = {
    "anthropic": ("https://api.anthropic.com/v1/models", lambda key: {"x-api-key": key, "anthropic-version": "2023-06-01"}),
    "openai": ("https://api.openai.com/v1/models", lambda key: {"Authorization": f"Bearer {key}"}),
    "gemini": (None, None),  # Uses query param
    "openrouter": ("https://openrouter.ai/api/v1/models", lambda key: {"Authorization": f"Bearer {key}"}),
}


@router.post("/api-keys", response_model=APIKeySaveResponse, status_code=status.HTTP_201_CREATED)
async def save_api_key(
    request: APIKeySaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if request.provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")

    encrypted_key, nonce = encrypt(request.api_key)
    user_uuid = uuid.UUID(current_user["id"])

    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user_uuid, APIKey.provider == request.provider)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.encrypted_key = encrypted_key
        existing.nonce = nonce
    else:
        db.add(APIKey(
            user_id=user_uuid,
            provider=request.provider,
            encrypted_key=encrypted_key,
            nonce=nonce,
        ))

    await db.commit()
    return APIKeySaveResponse(provider=request.provider, saved=True)


@router.get("/api-keys/{provider}", response_model=APIKeyStatusResponse)
async def get_api_key_status(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == uuid.UUID(current_user["id"]),
            APIKey.provider == provider,
        )
    )
    key = result.scalar_one_or_none()
    return APIKeyStatusResponse(provider=provider, is_set=key is not None)


@router.delete("/api-keys/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == uuid.UUID(current_user["id"]),
            APIKey.provider == provider,
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    await db.delete(key)
    await db.commit()
    return None


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    request: TestConnectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if request.provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{settings.ollama_url}/api/tags")
                resp.raise_for_status()
            return TestConnectionResponse(provider="ollama", status="ok")
        except Exception as e:
            return TestConnectionResponse(provider="ollama", status="error", message=str(e))

    if request.provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {request.provider}")

    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == uuid.UUID(current_user["id"]),
            APIKey.provider == request.provider,
        )
    )
    key_record = result.scalar_one_or_none()
    if key_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No API key set for {request.provider}")

    api_key = decrypt(key_record.encrypted_key, key_record.nonce)

    if request.provider == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1/models?key={api_key}"
        headers = {}
    else:
        url, header_fn = TEST_URLS[request.provider]
        headers = header_fn(api_key)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
        return TestConnectionResponse(provider=request.provider, status="ok")
    except httpx.HTTPStatusError as e:
        return TestConnectionResponse(
            provider=request.provider, status="error", message=f"HTTP {e.response.status_code}"
        )
    except Exception as e:
        return TestConnectionResponse(provider=request.provider, status="error", message=str(e))
```

- [ ] **Step 3: Register settings router in main.py**

Update the import in `src-api/app/main.py`:

```python
from app.routers import auth, documents, settings as settings_router
```

Add after `app.include_router(documents.router)`:

```python
app.include_router(settings_router.router)
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd src-api && uv run pytest tests/unit/ -v`
Expected: all 27 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-api/app/schemas/settings.py src-api/app/routers/settings.py src-api/app/main.py
git commit -m "Add settings router for API key management"
```

---

### Task 10: Docker Compose — Redis and Worker

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml**

Replace the full `docker-compose.yml` with:

```yaml
services:
  # === Shared service definitions ===

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vitae
      POSTGRES_USER: vitae
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-vitaepass}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitae -d vitae"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  api:
    build:
      context: ./src-api
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://vitae:${POSTGRES_PASSWORD:-vitaepass}@postgres:5432/vitae
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      SECRET_KEY: ${SECRET_KEY:-change-me-in-production}
      REDIS_URL: redis://redis:6379
      UPLOAD_DIR: /data/uploads
      SITE_URL: ${SITE_URL:-http://localhost:8080}
      ADMIN_URL: ${ADMIN_URL:-http://localhost:5173}
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    volumes:
      - uploads-data:/data/uploads
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - app-network

  worker:
    build:
      context: ./src-api
      dockerfile: Dockerfile
    command: ["uv", "run", "arq", "app.worker.WorkerSettings"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://vitae:${POSTGRES_PASSWORD:-vitaepass}@postgres:5432/vitae
      SECRET_KEY: ${SECRET_KEY:-change-me-in-production}
      REDIS_URL: redis://redis:6379
      UPLOAD_DIR: /data/uploads
      LOG_LEVEL: ${LOG_LEVEL:-info}
    volumes:
      - uploads-data:/data/uploads
    networks:
      - app-network

  # === Dev profile ===

  postgres-dev:
    extends:
      service: postgres
    profiles: ["dev"]
    ports:
      - "5432:5432"

  redis-dev:
    extends:
      service: redis
    profiles: ["dev"]
    ports:
      - "6379:6379"

  api-dev:
    extends:
      service: api
    profiles: ["dev"]
    ports:
      - "8000:8000"
    volumes:
      - ./src-api/app:/app/app
      - ./src-api/migrations:/app/migrations
      - uploads-data:/data/uploads
    environment:
      LOG_LEVEL: debug
    command: ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

  worker-dev:
    extends:
      service: worker
    profiles: ["dev"]
    volumes:
      - ./src-api/app:/app/app
      - uploads-data:/data/uploads
    environment:
      LOG_LEVEL: debug

  frontend-dev:
    build:
      context: ./src-ui
      dockerfile: Dockerfile
      target: dev
    profiles: ["dev"]
    ports:
      - "5173:5173"
    volumes:
      - ./src-ui/src:/app/src
      - ./src-ui/public:/app/public
    depends_on:
      api-dev:
        condition: service_healthy
    networks:
      - app-network

volumes:
  postgres-data:
  uploads-data:

networks:
  app-network:
    driver: bridge
```

- [ ] **Step 2: Verify compose config is valid**

Run: `docker compose config --quiet`
Expected: exits 0 (no errors)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "Add Redis and Worker services to Docker Compose"
```

---

### Task 11: Integration Tests — Document Flow

**Files:**
- Create: `src-api/tests/integration/test_document_flow.py`

- [ ] **Step 1: Create document flow integration tests**

Create `src-api/tests/integration/test_document_flow.py`:

```python
import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.database import get_db
from app.main import app
from app.models import Base
from app.models.document import Document
from app.services.document_parser import parse_document

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="module")
def db_url(postgres_container):
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture
async def test_env(db_url, tmp_path):
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    upload_dir = str(tmp_path / "uploads")

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.state.arq_pool = AsyncMock()

    # Patch settings for upload dir
    from app.config import settings
    original_upload_dir = settings.upload_dir
    settings.upload_dir = upload_dir

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, session_factory, upload_dir

    settings.upload_dir = original_upload_dir
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _register_and_get_token(client: AsyncClient) -> str:
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "SecurePass123!"},
    )
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestDocumentUpload:
    async def test_upload_markdown_returns_processing(self, test_env):
        client, _, _ = test_env
        token = await _register_and_get_token(client)
        with open(FIXTURES_DIR / "sample.md", "rb") as f:
            resp = await client.post(
                "/api/documents/",
                files={"files": ("resume.md", f, "text/markdown")},
                headers=_auth_headers(token),
            )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "processing"
        assert data[0]["filename"] == "resume.md"
        assert data[0]["parsed_text"] is None

    async def test_upload_rejects_unsupported_type(self, test_env):
        client, _, _ = test_env
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/documents/",
            files={"files": ("evil.exe", b"binary stuff", "application/x-msdownload")},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 415

    async def test_upload_requires_auth(self, test_env):
        client, _, _ = test_env
        resp = await client.post(
            "/api/documents/",
            files={"files": ("test.md", b"# Test", "text/markdown")},
        )
        assert resp.status_code == 401


class TestDocumentLifecycle:
    async def test_upload_parse_list_get_delete(self, test_env):
        client, session_factory, upload_dir = test_env
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)

        # Upload
        with open(FIXTURES_DIR / "sample.md", "rb") as f:
            resp = await client.post(
                "/api/documents/",
                files={"files": ("resume.md", f, "text/markdown")},
                headers=headers,
            )
        assert resp.status_code == 201
        doc_id = resp.json()[0]["id"]

        # Manually parse (simulates worker)
        async with session_factory() as session:
            result = await session.execute(
                select(Document).where(Document.id == uuid.UUID(doc_id))
            )
            doc = result.scalar_one()
            full_path = str(Path(upload_dir) / doc.file_path)
            doc.parsed_text = parse_document(full_path, doc.content_type)
            doc.status = "completed"
            await session.commit()

        # Get — should be completed with parsed text
        resp = await client.get(f"/api/documents/{doc_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert "John Doe" in data["parsed_text"]

        # List — should contain the document
        resp = await client.get("/api/documents/", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        assert any(d["id"] == doc_id for d in resp.json())

        # Delete
        resp = await client.delete(f"/api/documents/{doc_id}", headers=headers)
        assert resp.status_code == 204

        # Verify deleted
        resp = await client.get(f"/api/documents/{doc_id}", headers=headers)
        assert resp.status_code == 404

        # Verify file removed
        assert not Path(full_path).exists()


class TestDocumentOwnership:
    async def test_cannot_access_other_users_documents(self, test_env):
        client, _, _ = test_env
        token1 = await _register_and_get_token(client)
        token2 = await _register_and_get_token(client)

        # User 1 uploads
        with open(FIXTURES_DIR / "sample.md", "rb") as f:
            resp = await client.post(
                "/api/documents/",
                files={"files": ("resume.md", f, "text/markdown")},
                headers=_auth_headers(token1),
            )
        doc_id = resp.json()[0]["id"]

        # User 2 cannot access
        resp = await client.get(f"/api/documents/{doc_id}", headers=_auth_headers(token2))
        assert resp.status_code == 404

        # User 2 cannot delete
        resp = await client.delete(f"/api/documents/{doc_id}", headers=_auth_headers(token2))
        assert resp.status_code == 404
```

- [ ] **Step 2: Run integration tests**

Run: `cd src-api && uv run pytest tests/integration/test_document_flow.py -v`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src-api/tests/integration/test_document_flow.py
git commit -m "Add integration tests for document upload flow"
```

---

### Task 12: Integration Tests — API Keys

**Files:**
- Create: `src-api/tests/integration/test_api_keys.py`

- [ ] **Step 1: Create API key integration tests**

Create `src-api/tests/integration/test_api_keys.py`:

```python
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.database import get_db
from app.main import app
from app.models import Base


@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="module")
def db_url(postgres_container):
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture
async def client(db_url):
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _register_and_get_token(client: AsyncClient) -> str:
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "SecurePass123!"},
    )
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestAPIKeySave:
    async def test_save_key_returns_201(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/settings/api-keys",
            json={"provider": "anthropic", "api_key": "sk-ant-test-key"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 201
        assert resp.json()["provider"] == "anthropic"
        assert resp.json()["saved"] is True

    async def test_save_key_upserts(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)
        await client.post(
            "/api/settings/api-keys",
            json={"provider": "openai", "api_key": "sk-old-key"},
            headers=headers,
        )
        resp = await client.post(
            "/api/settings/api-keys",
            json={"provider": "openai", "api_key": "sk-new-key"},
            headers=headers,
        )
        assert resp.status_code == 201

    async def test_save_invalid_provider_returns_400(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/settings/api-keys",
            json={"provider": "invalid", "api_key": "key"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400

    async def test_save_requires_auth(self, client):
        resp = await client.post(
            "/api/settings/api-keys",
            json={"provider": "anthropic", "api_key": "key"},
        )
        assert resp.status_code == 401


class TestAPIKeyStatus:
    async def test_key_is_set_after_save(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)
        await client.post(
            "/api/settings/api-keys",
            json={"provider": "anthropic", "api_key": "sk-ant-test"},
            headers=headers,
        )
        resp = await client.get("/api/settings/api-keys/anthropic", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["is_set"] is True

    async def test_key_not_set_by_default(self, client):
        token = await _register_and_get_token(client)
        resp = await client.get(
            "/api/settings/api-keys/gemini",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["is_set"] is False

    async def test_status_never_returns_actual_key(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)
        await client.post(
            "/api/settings/api-keys",
            json={"provider": "openai", "api_key": "sk-secret-key-12345"},
            headers=headers,
        )
        resp = await client.get("/api/settings/api-keys/openai", headers=headers)
        body = resp.text
        assert "sk-secret-key-12345" not in body


class TestAPIKeyDelete:
    async def test_delete_existing_key(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)
        await client.post(
            "/api/settings/api-keys",
            json={"provider": "anthropic", "api_key": "sk-key"},
            headers=headers,
        )
        resp = await client.delete("/api/settings/api-keys/anthropic", headers=headers)
        assert resp.status_code == 204

        resp = await client.get("/api/settings/api-keys/anthropic", headers=headers)
        assert resp.json()["is_set"] is False

    async def test_delete_nonexistent_key_returns_404(self, client):
        token = await _register_and_get_token(client)
        resp = await client.delete(
            "/api/settings/api-keys/openai",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404
```

- [ ] **Step 2: Run integration tests**

Run: `cd src-api && uv run pytest tests/integration/test_api_keys.py -v`
Expected: all tests PASS

- [ ] **Step 3: Run all tests**

Run: `cd src-api && uv run pytest -v`
Expected: all unit + integration tests PASS

- [ ] **Step 4: Commit**

```bash
git add src-api/tests/integration/test_api_keys.py
git commit -m "Add integration tests for API key management"
```

---

### Task 13: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `.env.example` (if not already updated)

- [ ] **Step 1: Update CLAUDE.md**

Update the following sections in `CLAUDE.md`:

**In "Common Commands" section**, add after the existing API commands:

```bash
# Worker — local development
cd src-api
uv run arq app.worker.WorkerSettings        # Run ARQ worker
```

**In "REST API Endpoints > Currently Implemented" section**, add the new endpoints:

```markdown
- `POST /api/documents` — Upload documents (multipart, returns processing status)
- `GET /api/documents` — List all documents (optional status filter)
- `GET /api/documents/:id` — Get document details and parsed text
- `DELETE /api/documents/:id` — Remove document and file
- `POST /api/settings/api-keys` — Save encrypted API key
- `GET /api/settings/api-keys/:provider` — Check if API key is set
- `DELETE /api/settings/api-keys/:provider` — Delete API key
- `POST /api/settings/test-connection` — Test LLM provider connectivity
```

**In "Database" section**, update current tables:

```markdown
- **Current tables**: `users`, `documents`, `api_keys`
```

**In "Current Phase" section**, update to reflect Phase 2a completion:

```markdown
**Phase 2a (Document Pipeline) is complete.** Includes:
- Document upload and storage (local filesystem)
- Document parsing (5 formats: .md, .docx, .pdf, .xlsx, .pptx)
- Background job processing via ARQ + Redis
- API key encryption (AES-256-GCM) and management
- Docker Compose with Redis and Worker services

**Phase 2b** is next: LiteLLM integration, profile synthesis via SSE, profile editing.
```

- [ ] **Step 2: Update README.md**

Add a "Document Repository" section and update the feature list to reflect Phase 2a capabilities. Keep it consistent with the CLAUDE.md updates. Update the architecture diagram to show Redis and Worker services.

- [ ] **Step 3: Update .env.example if needed**

Verify `.env.example` has all new env vars (REDIS_URL, UPLOAD_DIR, MAX_UPLOAD_SIZE_MB). These should already be added from Task 1. If not, add them.

- [ ] **Step 4: Verify all tests pass**

Run: `cd src-api && uv run pytest -v`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md .env.example
git commit -m "Update documentation for Phase 2a"
```
