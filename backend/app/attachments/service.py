import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.errors import AppError

FOLDER = ".moja/anexos"
MAX_BYTES = 10_000_000
MAX_PER_MESSAGE = 5
MAX_FILES = 200
EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".pdf",
    ".md",
    ".txt",
    ".json",
    ".csv",
}


@dataclass
class Attachment:
    name: str
    size: int
    modified: datetime


def folder_of(workspace: Path) -> Path:
    return workspace / FOLDER


def safe_name(raw: str) -> str:
    name = Path(raw.replace("\\", "/")).name
    extension = Path(name).suffix.lower()
    if extension not in EXTENSIONS:
        raise AppError(422, "attachment_type_invalid")
    stem = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(name).stem)
    stem = stem.strip(" .")[:80] or "anexo"
    return f"{stem}{extension}"


def unique_name(folder: Path, name: str) -> str:
    candidate = Path(name)
    number = 2
    while (folder / name).exists():
        name = f"{candidate.stem}-{number}{candidate.suffix}"
        number += 1
    return name


def _entry(file: Path) -> Attachment:
    stat = file.stat()
    return Attachment(
        name=file.name,
        size=stat.st_size,
        modified=datetime.fromtimestamp(stat.st_mtime, UTC),
    )


def list_attachments(workspace: Path) -> list[Attachment]:
    folder = folder_of(workspace)
    if not folder.is_dir():
        return []
    files = [item for item in folder.iterdir() if item.is_file()]
    return sorted(
        (_entry(item) for item in files),
        key=lambda item: item.modified,
        reverse=True,
    )


def save_attachment(workspace: Path, raw_name: str, data: bytes) -> Attachment:
    if not data:
        raise AppError(422, "attachment_empty")
    if len(data) > MAX_BYTES:
        raise AppError(413, "attachment_too_large")
    name = safe_name(raw_name)
    folder = folder_of(workspace)
    folder.mkdir(parents=True, exist_ok=True)
    if len(list(folder.iterdir())) >= MAX_FILES:
        raise AppError(409, "too_many_attachments")
    name = unique_name(folder, name)
    file = folder / name
    file.write_bytes(data)
    return _entry(file)


def attachment_file(workspace: Path, name: str) -> Path:
    if name != Path(name).name or name.startswith("."):
        raise AppError(404, "attachment_not_found")
    file = folder_of(workspace) / name
    if not file.is_file():
        raise AppError(404, "attachment_not_found")
    return file


def attachment_note(workspace: Path, names: list[str]) -> str:
    if not names:
        return ""
    lines = [
        f"- {FOLDER}/{attachment_file(workspace, name).name}"
        for name in dict.fromkeys(names)
    ]
    return (
        "\n\nThe user attached these files; read them with the Read tool "
        "before answering:\n" + "\n".join(lines)
    )
