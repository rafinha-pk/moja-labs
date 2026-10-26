import json

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.agent.models import AgentRun, RunStatus
from app.agent.options import EFFORTS, MODELS
from app.agent.router import RunOut, _out
from app.agent.service import purge_runs, start_run
from app.db import get_db
from app.documents.models import DocSnapshot
from app.documents.service import (
    DocChange,
    compare_docs,
    docs_diff,
    read_docs,
    workspace_of,
)
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_planning,
    can_view_project,
)
from app.members.permissions import AREAS
from app.projects.models import Project
from app.tasks import service
from app.tasks.models import Task, TaskSource
from app.tasks.schemas import (
    ChangedDoc,
    PlanApply,
    PlanState,
    SettingsIn,
    SettingsOut,
    TaskOut,
)

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

PROMPT_DIFF_LIMIT = 60_000


def _snapshot(db: Session, project_id: int) -> dict[str, str]:
    rows = db.scalars(
        select(DocSnapshot).where(DocSnapshot.project_id == project_id)
    )
    return {row.path: row.content for row in rows}


def _state(
    db: Session, project: Project
) -> tuple[PlanState, dict[str, str], dict[str, str], list[DocChange]]:
    current = read_docs(workspace_of(db, project.id))
    before = _snapshot(db, project.id)
    first = not before
    changes = compare_docs(before, current)
    reason = None
    if not current:
        reason = "no_docs"
    elif not first and not changes:
        reason = "nothing_new"
    state = PlanState(
        first=first,
        changed_files=[
            ChangedDoc(path=change.path, status=change.status)
            for change in changes
        ],
        can_search=reason is None,
        reason=reason,
    )
    return state, before, current, changes


def _search_prompt(
    db: Session,
    project_id: int,
    before: dict[str, str],
    current: dict[str, str],
    changes: list[DocChange],
    first: bool,
) -> str:
    existing = service.existing_tasks_text(db, project_id)
    if first:
        return (
            "This is the first task search for this project. Read every "
            "document under docs/ and README.md and propose the complete "
            "list of implementation tasks needed to build what they "
            "describe.\n\nExisting tasks (do not duplicate them):\n"
            f"{existing}"
        )
    listing = ", ".join(f"{c.path} ({c.status})" for c in changes)
    diff = docs_diff(before, current, changes)[:PROMPT_DIFF_LIMIT]
    return (
        "The documentation changed since the last task search.\n"
        f"Changed files: {listing}\n\n"
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
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return _state(db, access.project)[0]


@router.post("/plan/search", response_model=RunOut, status_code=201)
def search_tasks(
    access: ProjectAccess = can_edit_planning,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    project = access.project
    state, before, current, changes = _state(db, project)
    if not state.can_search:
        raise AppError(409, state.reason)
    prompt = _search_prompt(
        db, project.id, before, current, changes, state.first
    )
    run = start_run(
        db,
        project,
        access.user,
        "tasks",
        prompt,
        tools,
        new_conversation=True,
        docs_snapshot=json.dumps(current, ensure_ascii=False),
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
        area = str(item.get("area", ""))
        if area not in AREAS:
            area = "fullstack"
        created.append(
            service.create_task(
                db,
                project.id,
                title,
                description,
                TaskSource.AI,
                service.effective_area(project.type, area),
            )
        )
    if run.docs_snapshot:
        db.execute(
            delete(DocSnapshot).where(DocSnapshot.project_id == project.id)
        )
        for path, content in json.loads(run.docs_snapshot).items():
            db.add(
                DocSnapshot(project_id=project.id, path=path, content=content)
            )
    db.commit()
    purge_runs(db, project.id, tools.claude_home, "tasks")
    return service.tasks_out(db, created)
