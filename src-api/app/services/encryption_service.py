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
