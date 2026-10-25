import difflib
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.errors import AppError

FOLDER = "docs"
ROOT_FILE = "README.md"
MAX_BYTES = 500_000
REQUIRED = ("docs/escopo.md", "docs/planejamento.md")


@dataclass
class DocChange:
    path: str
    status: str


def workspace_of(db: Session, project_id: int) -> Path:
    environment = current(db, project_id)
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
        or not environment.workspace
    ):
        raise AppError(409, "environment_not_ready")
    return Path(environment.workspace)


def read_docs(workspace: Path) -> dict[str, str]:
    files = sorted((workspace / FOLDER).rglob("*.md"))
    files.insert(0, workspace / ROOT_FILE)
    found: dict[str, str] = {}
    for file in files:
        if not file.is_file() or file.stat().st_size > MAX_BYTES:
            continue
        found[file.relative_to(workspace).as_posix()] = file.read_text(
            encoding="utf-8", errors="replace"
        )
    return found


def compare_docs(old: dict[str, str], new: dict[str, str]) -> list[DocChange]:
    changes = []
    for path in sorted(old.keys() | new.keys()):
        if path not in old:
            changes.append(DocChange(path, "added"))
        elif path not in new:
            changes.append(DocChange(path, "removed"))
        elif old[path] != new[path]:
            changes.append(DocChange(path, "modified"))
    return changes


def docs_diff(
    old: dict[str, str], new: dict[str, str], changes: list[DocChange]
) -> str:
    parts = []
    for change in changes:
        before = old.get(change.path, "").splitlines()
        after = new.get(change.path, "").splitlines()
        lines = difflib.unified_diff(
            before,
            after,
            fromfile=f"a/{change.path}",
            tofile=f"b/{change.path}",
            lineterm="",
        )
        parts.append("\n".join(lines))
    return "\n".join(parts)
