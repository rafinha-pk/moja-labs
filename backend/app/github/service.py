from sqlalchemy import select
from sqlalchemy.orm import Session

from app.clock import utcnow
from app.errors import AppError
from app.github.client import GitHubClient
from app.github.crypto import decrypt, encrypt
from app.github.models import GithubCredential, ProjectRepository
from app.github.schemas import RepositoryCreate
from app.projects.models import Project
from app.setup.templates import starter_files


def account_credential(db: Session, user_id: int) -> GithubCredential | None:
    return db.scalar(
        select(GithubCredential).where(
            GithubCredential.user_id == user_id,
            GithubCredential.project_id.is_(None),
        )
    )


def project_credential(
    db: Session, project_id: int
) -> GithubCredential | None:
    return db.scalar(
        select(GithubCredential).where(
            GithubCredential.project_id == project_id
        )
    )


def resolve_credential(
    db: Session, project: Project
) -> tuple[GithubCredential | None, str]:
    own = project_credential(db, project.id)
    if own is not None:
        return own, "project"
    shared = account_credential(db, project.owner_id)
    return (shared, "account") if shared is not None else (None, "none")


def save_credential(
    db: Session,
    user_id: int,
    project_id: int | None,
    token: str,
    login: str,
) -> None:
    existing = (
        account_credential(db, user_id)
        if project_id is None
        else project_credential(db, project_id)
    )
    if existing is None:
        existing = GithubCredential(user_id=user_id, project_id=project_id)
        db.add(existing)
    existing.token_encrypted = encrypt(token)
    existing.login = login
    db.commit()


def usable_token(db: Session, project: Project) -> str:
    credential, _ = resolve_credential(db, project)
    if credential is None:
        raise AppError(409, "github_not_connected")
    return decrypt(credential.token_encrypted)


def project_repository(
    db: Session, project_id: int
) -> ProjectRepository | None:
    return db.scalar(
        select(ProjectRepository).where(
            ProjectRepository.project_id == project_id
        )
    )


def _require_free(db: Session, project: Project) -> None:
    if project_repository(db, project.id) is not None:
        raise AppError(409, "repository_already_linked")


def _attach(db: Session, project: Project, data: dict, origin: str) -> None:
    db.add(
        ProjectRepository(
            project_id=project.id,
            full_name=data["full_name"],
            html_url=data["html_url"],
            is_private=data["private"],
            origin=origin,
        )
    )
    db.commit()


def create_repository(
    db: Session,
    project: Project,
    make_client: type[GitHubClient],
    body: RepositoryCreate,
) -> None:
    _require_free(db, project)
    client = make_client(usable_token(db, project))
    data = client.create_repo(body.name, body.description, body.private)
    _attach(db, project, data, "created")


def link_repository(
    db: Session,
    project: Project,
    make_client: type[GitHubClient],
    full_name: str,
) -> None:
    _require_free(db, project)
    data = make_client(usable_token(db, project)).get_repo(full_name)
    _attach(db, project, data, "linked")


def initialize_repository(
    db: Session, project: Project, make_client: type[GitHubClient]
) -> None:
    repository = project_repository(db, project.id)
    if repository is None:
        raise AppError(409, "repository_not_linked")
    if repository.origin == "linked":
        raise AppError(409, "initial_commit_not_applicable")
    if repository.initialized_at is not None:
        return
    client = make_client(usable_token(db, project))
    for path, content, message in starter_files(project):
        if not client.file_exists(repository.full_name, path):
            client.put_file(repository.full_name, path, content, message)
    repository.initialized_at = utcnow()
    db.commit()
