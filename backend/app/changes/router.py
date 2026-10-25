from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.agent.router import RunOut, _out
from app.agent.service import start_run
from app.db import get_db
from app.environments.docker import DockerError
from app.environments.gitops import Repo, git_credentials
from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.github.service import usable_token
from app.members.access import (
    ProjectAccess,
    can_run_project,
    can_view_project,
)

router = APIRouter(prefix="/projects/{project_id}/changes", tags=["changes"])

Message = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class CommitIn(BaseModel):
    message: Message


class FileChange(BaseModel):
    status: str
    path: str


class CommitOut(BaseModel):
    hash: str
    subject: str


class HistoryOut(BaseModel):
    hash: str
    author: str
    when: str
    subject: str
    pushed: bool


class ChangesOut(BaseModel):
    branch: str
    files: list[FileChange]
    diff: str
    unpushed: list[CommitOut]
    commits: list[HistoryOut]


def _repo(db: Session, project_id: int, tools: EnvironmentTools) -> Repo:
    environment = current(db, project_id)
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
        or not environment.container
    ):
        raise AppError(409, "environment_not_ready")
    repo = Repo(tools.docker, environment.container)
    try:
        repo.turn_on()
    except DockerError:
        raise AppError(502, "docker_unavailable") from None
    return repo


def _snapshot(repo: Repo) -> ChangesOut:
    try:
        files = repo.changes()
        unpushed = repo.unpushed()
        waiting = {commit.hash for commit in unpushed}
        return ChangesOut(
            branch=repo.branch(),
            files=[FileChange(status=c.status, path=c.path) for c in files],
            diff=repo.diff() if files else "",
            unpushed=[
                CommitOut(hash=c.hash, subject=c.subject) for c in unpushed
            ],
            commits=[
                HistoryOut(
                    hash=entry.hash,
                    author=entry.author,
                    when=entry.when,
                    subject=entry.subject,
                    pushed=entry.hash not in waiting,
                )
                for entry in repo.history()
            ],
        )
    except DockerError:
        raise AppError(502, "git_failed") from None


@router.get("", response_model=ChangesOut)
def read_changes(
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    return _snapshot(_repo(db, access.project.id, tools))


@router.post("/commit", response_model=ChangesOut)
def commit_changes(
    body: CommitIn,
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    repo = _repo(db, access.project.id, tools)
    try:
        if not repo.changes():
            raise AppError(409, "nothing_to_commit")
        repo.commit(body.message)
    except DockerError:
        raise AppError(502, "git_failed") from None
    return _snapshot(repo)


@router.post("/push", response_model=ChangesOut)
def push_changes(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    repo = _repo(db, access.project.id, tools)
    credentials, _ = git_credentials(usable_token(db, access.project))
    try:
        repo.push(credentials)
    except DockerError:
        raise AppError(502, "push_failed") from None
    return _snapshot(repo)


@router.post("/suggest", response_model=RunOut, status_code=201)
def suggest_message(
    access: ProjectAccess = can_run_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    repo = _repo(db, access.project.id, tools)
    try:
        if not repo.changes():
            raise AppError(409, "nothing_to_commit")
        diff = repo.diff()
        recent = [entry.subject for entry in repo.history(10)]
    except DockerError:
        raise AppError(502, "git_failed") from None
    listing = "\n".join(f"- {subject}" for subject in recent) or "(none)"
    prompt = (
        "Write the commit message for these uncommitted changes.\n\n"
        f"Recent commits:\n{listing}\n\n```diff\n{diff}\n```"
    )
    run = start_run(
        db,
        access.project,
        access.user,
        "commit",
        prompt,
        tools,
        new_conversation=True,
    )
    return _out(run)
