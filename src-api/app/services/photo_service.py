"""Photo upload, validation, resize, and storage."""

import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.config import settings

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 800

MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MIME_TO_FORMAT = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def validate_photo(content_type: str, size: int) -> None:
    """Raise ValueError if the file is not a valid photo."""
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"File type {content_type} not allowed. Use JPEG, PNG, or WebP.")
    if size > MAX_SIZE_BYTES:
        raise ValueError(f"File size {size} bytes exceeds maximum of {MAX_SIZE_BYTES} bytes.")


def resize_photo(data: bytes, content_type: str) -> bytes:
    """Resize image so longest dimension is at most MAX_DIMENSION. Returns bytes."""
    img = Image.open(BytesIO(data))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        if w >= h:
            new_w = MAX_DIMENSION
            new_h = int(h * MAX_DIMENSION / w)
        else:
            new_h = MAX_DIMENSION
            new_w = int(w * MAX_DIMENSION / h)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = BytesIO()
    fmt = MIME_TO_FORMAT.get(content_type, "JPEG")
    img.save(buf, format=fmt, quality=85)
    return buf.getvalue()


def save_photo(user_id: uuid.UUID, data: bytes, content_type: str) -> str:
    """Save photo bytes to disk. Returns relative path."""
    ext = MIME_TO_EXT.get(content_type, "jpg")
    rel_path = f"photos/{user_id}/profile.{ext}"
    full_path = Path(settings.upload_dir) / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Remove any existing photo with different extension
    for existing in full_path.parent.glob("profile.*"):
        existing.unlink()

    full_path.write_bytes(data)
    return rel_path


def delete_photo(rel_path: str) -> None:
    """Delete a photo file from disk."""
    full_path = Path(settings.upload_dir) / rel_path
    if full_path.exists():
        full_path.unlink()
