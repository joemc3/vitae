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
