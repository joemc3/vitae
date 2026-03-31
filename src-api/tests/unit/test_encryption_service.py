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
