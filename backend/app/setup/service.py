from sqlalchemy.orm import Session

from app.environments import service as environments
from app.environments.models import ProjectEnvironment
from app.environments.tools import EnvironmentTools
from app.errors import AppError
from app.github import service as github
from app.github.client import GitHubClient
from app.github.models import ProjectRepository
from app.github.schemas import RepositoryCreate
from app.projects.models import Project, ProjectType

SETUP_STEPS: dict[str, tuple[str, ...]] = {
    ProjectType.WEB.value: ("repository", "initial_commit", "environment"),
    ProjectType.MOBILE.value: ("repository", "initial_commit", "environment"),
}
FINISHED = ("done", "skipped")
RETRYABLE = ("todo", "failed")
ENVIRONMENT_STATUS = {"building": "doing", "ready": "done", "failed": "failed"}


def _status(
    key: str,
    repository: ProjectRepository | None,
    environment: ProjectEnvironment | None,
) -> str:
    if key == "repository":
        return "done" if repository else "todo"
    if key == "initial_commit":
        if repository is None:
            return "todo"
        if repository.origin == "linked":
            return "skipped"
        return "done" if repository.initialized_at else "todo"
    if environment is None:
        return "todo"
    return ENVIRONMENT_STATUS[environment.status]


def setup_steps(db: Session, project: Project) -> list[dict[str, str]]:
    repository = github.project_repository(db, project.id)
    environment = environments.current(db, project.id)
    return [
        {"key": key, "status": _status(key, repository, environment)}
        for key in SETUP_STEPS.get(project.type, ())
    ]


def setup_complete(db: Session, project: Project) -> bool:
    return all(step["status"] in FINISHED for step in setup_steps(db, project))


def _statuses(db: Session, project: Project) -> dict[str, str]:
    return {step["key"]: step["status"] for step in setup_steps(db, project)}


def start_environment(
    db: Session, project: Project, tools: EnvironmentTools
) -> None:
    statuses = _statuses(db, project)
    if statuses.get("repository") != "done":
        raise AppError(409, "repository_not_linked")
    if statuses.get("initial_commit") not in FINISHED:
        raise AppError(409, "initial_commit_pending")
    environments.start_environment(db, project, tools)


def run_setup(
    db: Session,
    project: Project,
    make_client: type[GitHubClient],
    tools: EnvironmentTools,
    repository: RepositoryCreate | None,
) -> None:
    if _statuses(db, project).get("repository") == "todo":
        if repository is None:
            raise AppError(400, "repository_required")
        github.create_repository(db, project, make_client, repository)
    if _statuses(db, project).get("initial_commit") == "todo":
        github.initialize_repository(db, project, make_client)
    if _statuses(db, project).get("environment") in RETRYABLE:
        start_environment(db, project, tools)
