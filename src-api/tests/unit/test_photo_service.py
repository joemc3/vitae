import uuid
from io import BytesIO
from unittest.mock import patch

import pytest

from app.services.photo_service import (
    validate_photo,
    resize_photo,
    save_photo,
    delete_photo,
    ALLOWED_TYPES,
    MAX_SIZE_BYTES,
    MAX_DIMENSION,
)


class TestValidatePhoto:
    def test_rejects_invalid_content_type(self):
        with pytest.raises(ValueError, match="File type"):
            validate_photo(content_type="application/pdf", size=1000)

    def test_rejects_oversized_file(self):
        with pytest.raises(ValueError, match="exceeds"):
            validate_photo(content_type="image/jpeg", size=MAX_SIZE_BYTES + 1)

    def test_accepts_valid_jpeg(self):
        validate_photo(content_type="image/jpeg", size=1000)

    def test_accepts_valid_png(self):
        validate_photo(content_type="image/png", size=1000)

    def test_accepts_valid_webp(self):
        validate_photo(content_type="image/webp", size=1000)


class TestResizePhoto:
    def test_resizes_large_image(self):
        from PIL import Image
        img = Image.new("RGB", (1600, 1200), color="red")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        assert max(resized.size) <= MAX_DIMENSION

    def test_preserves_small_image(self):
        from PIL import Image
        img = Image.new("RGB", (400, 300), color="blue")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        assert resized.size == (400, 300)

    def test_preserves_aspect_ratio(self):
        from PIL import Image
        img = Image.new("RGB", (1600, 800), color="green")
        buf = BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        result = resize_photo(buf.read(), "image/jpeg")
        resized = Image.open(BytesIO(result))
        w, h = resized.size
        assert abs(w / h - 2.0) < 0.01


class TestSavePhoto:
    def test_saves_file_and_returns_path(self, tmp_path):
        user_id = uuid.uuid4()
        photo_bytes = b"fake-image-data"
        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            path = save_photo(user_id, photo_bytes, "image/jpeg")
        assert path.startswith(f"photos/{user_id}/profile.")
        assert (tmp_path / path).exists()

    def test_overwrites_existing(self, tmp_path):
        user_id = uuid.uuid4()
        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            path1 = save_photo(user_id, b"data1", "image/jpeg")
            path2 = save_photo(user_id, b"data2", "image/jpeg")
        assert path1 == path2
        assert (tmp_path / path2).read_bytes() == b"data2"


class TestDeletePhoto:
    def test_deletes_existing_file(self, tmp_path):
        user_id = uuid.uuid4()
        photo_dir = tmp_path / "photos" / str(user_id)
        photo_dir.mkdir(parents=True)
        photo_file = photo_dir / "profile.jpg"
        photo_file.write_bytes(b"data")
        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            delete_photo(f"photos/{user_id}/profile.jpg")
        assert not photo_file.exists()

    def test_ignores_missing_file(self, tmp_path):
        with patch("app.services.photo_service.settings") as mock_settings:
            mock_settings.upload_dir = str(tmp_path)
            delete_photo("photos/nonexistent/profile.jpg")
