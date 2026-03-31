import pytest

from app.services.username_validator import validate_username


class TestUsernameValidation:
    def test_valid_usernames(self):
        for name in ["joe", "jane-doe", "a123", "my-resume"]:
            assert validate_username(name) is None, f"{name} should be valid"

    def test_too_short(self):
        assert validate_username("ab") == "Username must be 3-50 characters"

    def test_too_long(self):
        assert validate_username("a" * 51) == "Username must be 3-50 characters"

    def test_must_start_with_letter(self):
        assert validate_username("123abc") == "Username must start with a letter"
        assert validate_username("-abc") == "Username must start with a letter"

    def test_invalid_characters(self):
        assert validate_username("joe_doe") == "Username may only contain lowercase letters, numbers, and hyphens"
        assert validate_username("Joe") == "Username may only contain lowercase letters, numbers, and hyphens"
        assert validate_username("joe doe") == "Username may only contain lowercase letters, numbers, and hyphens"

    def test_reserved_words(self):
        for word in ["admin", "api", "static", "health", "login", "register", "settings"]:
            assert validate_username(word) == "Username is reserved"

    def test_no_trailing_hyphen(self):
        assert validate_username("joe-") == "Username may only contain lowercase letters, numbers, and hyphens"

    def test_no_consecutive_hyphens(self):
        assert validate_username("joe--doe") == "Username may only contain lowercase letters, numbers, and hyphens"
