import json
import os
import subprocess
import tempfile
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.clock import utcnow
from app.environments.tools import EnvironmentTools
from app.usage.models import ClaudeUsage

ROW_ID = 1
PROBE_MODEL = "claude-haiku-5-5"
PROBE_TIMEOUT = 90
WINDOWS = ("five_hour", "seven_day")


def record(db: Session, info: dict) -> bool:
    windows = info.get("unifiedWindows")
    if not isinstance(windows, dict):
        return False
    row = db.get(ClaudeUsage, ROW_ID)
    if row is None:
        row = ClaudeUsage(id=ROW_ID)
        db.add(row)
    found = False
    for name in WINDOWS:
        window = windows.get(name)
        if not isinstance(window, dict):
            continue
        try:
            percent = round(float(window["utilization"]) * 100, 1)
            resets = datetime.fromtimestamp(
                int(window["resetsAt"]), UTC
            ).replace(tzinfo=None)
        except (KeyError, TypeError, ValueError, OverflowError, OSError):
            continue
        setattr(row, f"{name}_percent", percent)
        setattr(row, f"{name}_resets_at", resets)
        found = True
    if found:
        row.updated_at = utcnow()
        db.commit()
    return found


def probe(db: Session, tools: EnvironmentTools) -> bool:
    command = [
        *tools.claude_command,
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        PROBE_MODEL,
        "--effort",
        "low",
        "--tools",
        "",
        "--no-session-persistence",
        "--setting-sources",
        "project,local",
    ]
    env = {**os.environ, "MAX_THINKING_TOKENS": "0"}
    with tempfile.TemporaryDirectory() as folder:
        try:
            result = subprocess.run(
                command,
                input="Reply only: ok",
                cwd=folder,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=PROBE_TIMEOUT,
                env=env,
            )
        except (OSError, subprocess.TimeoutExpired):
            return False
    recorded = False
    for line in result.stdout.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "rate_limit_event":
            recorded = record(db, event.get("rate_limit_info") or {}) or recorded
    return recorded
