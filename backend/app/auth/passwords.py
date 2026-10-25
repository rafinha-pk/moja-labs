import base64
import hashlib
import hmac
import os

_N, _R, _P = 2**14, 8, 1
_DKLEN = 32
_MAXMEM = 64 * 1024 * 1024


def _scrypt(
    password: str, salt: bytes, n: int, r: int, p: int, dklen: int
) -> bytes:
    return hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=dklen,
        maxmem=_MAXMEM,
    )


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = _scrypt(password, salt, _N, _R, _P, _DKLEN)
    return "$".join(
        [
            "scrypt",
            str(_N),
            str(_R),
            str(_P),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        candidate = _scrypt(
            password,
            base64.b64decode(salt),
            int(n),
            int(r),
            int(p),
            len(expected),
        )
    except ValueError, TypeError:
        return False
    return hmac.compare_digest(candidate, expected)
