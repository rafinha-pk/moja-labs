from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.documents.service import (
    FOLDER,
    MAX_BYTES,
    REQUIRED,
    ROOT_FILE,
    workspace_of,
)
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["docs"])

class DocumentOut(BaseModel):
    path: str
    size: int
    modified: datetime | None
    exists: bool
    required: bool


class DocumentContent(BaseModel):
    path: str
    content: str


class DocumentIn(BaseModel):
    path: str = Field(min_length=1, max_length=200)
    content: str = Field(max_length=MAX_BYTES)


def _resolve(workspace: Path, path: str) -> Path:
    parts = Path(path).parts
    allowed = path == ROOT_FILE or (len(parts) > 1 and parts[0] == FOLDER)
    if (
        not allowed
        or not path.endswith(".md")
        or "\\" in path
        or Path(path).is_absolute()
        or any(part.startswith(".") for part in parts)
    ):
        raise AppError(422, "invalid_document_path")
    target = (workspace / path).resolve()
    if not target.is_relative_to(workspace.resolve()):
        raise AppError(422, "invalid_document_path")
    return target


def _entry(workspace: Path, file: Path) -> DocumentOut:
    info = file.stat()
    return DocumentOut(
        path=file.relative_to(workspace).as_posix(),
        size=info.st_size,
        modified=datetime.fromtimestamp(info.st_mtime, UTC),
        exists=True,
        required=file.relative_to(workspace).as_posix() in REQUIRED,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    workspace = workspace_of(db, access.project.id)
    files = sorted((workspace / FOLDER).rglob("*.md"))
    root = workspace / ROOT_FILE
    if root.is_file():
        files.insert(0, root)
    entries = [_entry(workspace, file) for file in files if file.is_file()]
    present = {entry.path for entry in entries}
    entries += [
        DocumentOut(
            path=path, size=0, modified=None, exists=False, required=True
        )
        for path in REQUIRED
        if path not in present
    ]
    return entries


@router.get("/file", response_model=DocumentContent)
def read_document(
    path: str = Query(max_length=200),
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
):
    workspace = workspace_of(db, access.project.id)
    target = _resolve(workspace, path)
    if not target.is_file():
        raise AppError(404, "document_not_found")
    return DocumentContent(
        path=path, content=target.read_text(encoding="utf-8", errors="replace")
    )


@router.put("/file", response_model=DocumentContent)
def save_document(
    body: DocumentIn,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    workspace = workspace_of(db, access.project.id)
    target = _resolve(workspace, body.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8", newline="\n")
    return DocumentContent(path=body.path, content=body.content)


@router.delete("/file", status_code=204)
def delete_document(
    path: str = Query(max_length=200),
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
) -> None:
    workspace = workspace_of(db, access.project.id)
    target = _resolve(workspace, path)
    if not target.is_file():
        raise AppError(404, "document_not_found")
    target.unlink()
    docs = (workspace / FOLDER).resolve()
    folder = target.parent
    while (
        folder != docs
        and folder.is_relative_to(docs)
        and not any(folder.iterdir())
    ):
        folder.rmdir()
        folder = folder.parent
