import re

RESERVED_USERNAMES = frozenset({
    "admin", "api", "static", "health", "login", "register", "settings",
})

USERNAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")


def validate_username(username: str) -> str | None:
    """Return an error message if invalid, or None if valid."""
    if len(username) < 3 or len(username) > 50:
        return "Username must be 3-50 characters"

    if not username[0].isalpha():
        return "Username must start with a letter"

    if not USERNAME_PATTERN.match(username):
        return "Username may only contain lowercase letters, numbers, and hyphens"

    if username in RESERVED_USERNAMES:
        return "Username is reserved"

    return None
