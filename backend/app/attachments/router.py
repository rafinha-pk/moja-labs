from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.attachments import service
from app.db import get_db
from app.documents.service import workspace_of
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)

router = APIRouter(
    prefix="/projects/{project_id}/attachments", tags=["attachments"]
)


class AttachmentOut(BaseModel):
    name: str
    size: int
    modified: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AttachmentOut])
def list_attachments(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return service.list_attachments(workspace_of(db, access.project.id))


@router.put("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    name: str,
    request: Request,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    workspace = workspace_of(db, access.project.id)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > service.MAX_BYTES:
        raise AppError(413, "attachment_too_large")
    return service.save_attachment(workspace, name, await request.body())


@router.delete("/{name}", status_code=204)
def delete_attachment(
    name: str,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    workspace = workspace_of(db, access.project.id)
    service.attachment_file(workspace, name).unlink()
    return Response(status_code=204)
