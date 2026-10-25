import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not _EMAIL_RE.match(value):
        raise ValueError("invalid_email")
    return value


Email = Annotated[str, AfterValidator(normalize_email)]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
