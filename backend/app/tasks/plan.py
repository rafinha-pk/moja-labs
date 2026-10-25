import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.models import AgentRun, RunStatus
from app.agent.options import EFFORTS, MODELS
from app.agent.router import RunOut, _out
from app.agent.service import purge_runs, start_run
from app.db import get_db
from app.environments.docker import DockerError
from app.environments.gitops import Repo
from app.environments.models import EnvironmentStatus
from app.environments.service import current
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)
from app.projects.models import Project
from app.tasks import service
from app.tasks.models import Task, TaskSource
from app.tasks.schemas import (
    PlanApply,
    PlanState,
    SettingsIn,
    SettingsOut,
    TaskOut,
)

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

PROMPT_DIFF_LIMIT = 60_000
SHORT = 8


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


def _state(project: Project, repo: Repo) -> PlanState:
    try:
        head = repo.head()
        base = project.tasks_base_commit
        if base is not None and not repo.knows(base):
            base = None
        dirty = repo.docs_dirty()
        files = repo.docs_files(base) if base and head else []
    except DockerError:
        raise AppError(502, "git_failed") from None
    reason = None
    if head is None:
        reason = "no_commits"
    elif dirty:
        reason = "docs_uncommitted"
    elif base is not None and (head == base or not files):
        reason = "nothing_new"
    return PlanState(
        head=head,
        base=base,
        uncommitted=dirty,
        changed_files=files,
        can_search=reason is None,
        reason=reason,
    )


def _search_prompt(
    db: Session, project: Project, repo: Repo, state: PlanState
) -> str:
    existing = service.existing_tasks_text(db, project.id)
    if state.base is None:
        return (
            "This is the first task search for this project. Read every "
            "document under docs/ and README.md and propose the complete "
            "list of implementation tasks needed to build what they "
            "describe.\n\nExisting tasks (do not duplicate them):\n"
            f"{existing}"
        )
    diff = repo.docs_diff(state.base)[:PROMPT_DIFF_LIMIT]
    return (
        "The documentation changed between commit "
        f"{state.base[:SHORT]} and commit {state.head[:SHORT]}.\n"
        f"Changed files: {', '.join(state.changed_files)}\n\n"
        f"```diff\n{diff}\n```\n\n"
        "Read the changed documents if you need more context. Propose "
        "tasks only for what these changes require, without duplicating "
        f"the existing tasks:\n{existing}"
    )


def _settings(project: Project) -> SettingsOut:
    return SettingsOut(
        model=project.tasks_model,
        effort=project.tasks_effort,
        thinking=project.tasks_thinking,
        models=list(MODELS),
        efforts=list(EFFORTS),
    )


@router.get("/settings", response_model=SettingsOut)
def read_settings(access: ProjectAccess = can_view_project):
    return _settings(access.project)


@router.put("/settings", response_model=SettingsOut)
def save_settings(
    body: SettingsIn,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
):
    project = access.project
    project.tasks_model = body.model
    project.tasks_effort = body.effort
    project.tasks_thinking = body.thinking
    db.commit()
    return _settings(project)


@router.get("/plan", response_model=PlanState)
def read_plan(
    access: ProjectAccess = can_view_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    return _state(access.project, _repo(db, access.project.id, tools))


@router.post("/plan/search", response_model=RunOut, status_code=201)
def search_tasks(
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    repo = _repo(db, project.id, tools)
    state = _state(project, repo)
    if not state.can_search:
        raise AppError(409, state.reason)
    run = start_run(
        db,
        project,
        access.user,
        "tasks",
        _search_prompt(db, project, repo, state),
        tools,
        new_conversation=True,
        head_commit=state.head,
    )
    return _out(run)


@router.post("/plan/apply", response_model=list[TaskOut])
def apply_plan(
    body: PlanApply,
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    run = db.get(AgentRun, body.run_id)
    if (
        run is None
        or run.project_id != project.id
        or run.kind != "tasks"
        or run.status != RunStatus.DONE.value
        or not run.output
    ):
        raise AppError(409, "plan_not_ready")
    known = {
        task.title.casefold() for task in service.project_tasks(db, project.id)
    }
    created: list[Task] = []
    for item in json.loads(run.output).get("tasks", []):
        title = str(item.get("title", "")).strip()
        if not title or title[: service.TITLE_LIMIT].casefold() in known:
            continue
        known.add(title[: service.TITLE_LIMIT].casefold())
        description = str(item.get("description", "")).strip() or None
        created.append(
            service.create_task(
                db, project.id, title, description, TaskSource.AI
            )
        )
    if run.head_commit:
        project.tasks_base_commit = run.head_commit
    db.commit()
    purge_runs(db, project.id, tools.claude_home, "tasks")
    return service.tasks_out(db, created)
