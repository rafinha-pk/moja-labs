import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        return hits

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._prune(key, time.monotonic())) >= self.max_attempts

    def hit(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._prune(key, now).append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_email_limiter = RateLimiter(max_attempts=5, window_seconds=15 * 60)
login_ip_limiter = RateLimiter(max_attempts=30, window_seconds=15 * 60)
invite_limiter = RateLimiter(max_attempts=20, window_seconds=10 * 60)
usage_limiter = RateLimiter(max_attempts=6, window_seconds=60)


def reset_all() -> None:
    for limiter in (
        login_email_limiter,
        login_ip_limiter,
        invite_limiter,
        usage_limiter,
    ):
        limiter.reset()
