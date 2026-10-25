from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.github import service
from app.github.client import GitHubClient, github_client_factory
from app.github.schemas import (
    AccountOut,
    ProjectGithubOut,
    RepositoryCreate,
    RepositoryLink,
    TokenIn,
)
from app.members.access import (
    ProjectAccess,
    can_manage_integrations,
    can_view_project,
)
from app.projects.models import Project
from app.users.models import User

router = APIRouter(tags=["github"])


def _account_out(credential) -> AccountOut:
    if credential is None:
        return AccountOut(connected=False)
    return AccountOut(connected=True, login=credential.login)


def _project_out(db: Session, project: Project) -> ProjectGithubOut:
    credential, source = service.resolve_credential(db, project)
    return ProjectGithubOut(
        token_source=source,
        login=credential.login if credential else None,
        repository=service.project_repository(db, project.id),
    )


@router.get("/users/me/github", response_model=AccountOut)
def account_status(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _account_out(service.account_credential(db, user.id))


@router.put("/users/me/github", response_model=AccountOut)
def connect_account(
    body: TokenIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
):
    login = make_client(body.token).get_user()["login"]
    service.save_credential(db, user.id, None, body.token, login)
    return AccountOut(connected=True, login=login)


@router.delete("/users/me/github", status_code=204)
def disconnect_account(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    credential = service.account_credential(db, user.id)
    if credential is not None:
        db.delete(credential)
        db.commit()
    return Response(status_code=204)


@router.get("/projects/{project_id}/github", response_model=ProjectGithubOut)
def project_status(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return _project_out(db, access.project)


@router.put(
    "/projects/{project_id}/github/token", response_model=ProjectGithubOut
)
def set_project_token(
    body: TokenIn,
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
):
    login = make_client(body.token).get_user()["login"]
    service.save_credential(
        db, access.user.id, access.project.id, body.token, login
    )
    return _project_out(db, access.project)


@router.delete("/projects/{project_id}/github/token", status_code=204)
def clear_project_token(
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
):
    credential = service.project_credential(db, access.project.id)
    if credential is not None:
        db.delete(credential)
        db.commit()
    return Response(status_code=204)


@router.post(
    "/projects/{project_id}/github/repository",
    response_model=ProjectGithubOut,
    status_code=201,
)
def create_repository(
    body: RepositoryCreate,
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
):
    service.create_repository(db, access.project, make_client, body)
    return _project_out(db, access.project)


@router.put(
    "/projects/{project_id}/github/repository",
    response_model=ProjectGithubOut,
)
def link_repository(
    body: RepositoryLink,
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
    make_client: type[GitHubClient] = Depends(github_client_factory),
):
    service.link_repository(db, access.project, make_client, body.full_name)
    return _project_out(db, access.project)


@router.delete("/projects/{project_id}/github/repository", status_code=204)
def unlink_repository(
    access: ProjectAccess = can_manage_integrations,
    db: Session = Depends(get_db),
):
    repository = service.project_repository(db, access.project.id)
    if repository is not None:
        db.delete(repository)
        db.commit()
    return Response(status_code=204)
