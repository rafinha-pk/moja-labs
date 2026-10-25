from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.environments.agent_files import sync_agent_files
from app.environments.tools import EnvironmentTools, environment_tools
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_edit_project,
    can_view_project,
)
from app.skills.models import ProjectSkill, Skill, SkillScope
from app.skills.schemas import (
    ProjectSkillOut,
    ProjectSkillsUpdate,
    SkillCreate,
    SkillDetail,
    SkillOut,
    SkillUpdate,
)
from app.projects.models import Project
from app.users.models import User

router = APIRouter(tags=["skills"])


def _own(db: Session, user: User, skill_id: int) -> Skill:
    skill = db.get(Skill, skill_id)
    if skill is None or skill.user_id != user.id:
        raise AppError(404, "skill_not_found")
    return skill


def _commit_unique(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "skill_name_taken") from None


def _sync_projects(
    db: Session, project_ids: list[int], tools: EnvironmentTools
) -> None:
    for project in db.scalars(
        select(Project).where(Project.id.in_(project_ids))
    ):
        sync_agent_files(db, project, tools)


def _projects_using(db: Session, skill_id: int) -> list[int]:
    return list(
        db.scalars(
            select(ProjectSkill.project_id)
            .where(ProjectSkill.skill_id == skill_id)
            .distinct()
        )
    )


@router.get("/skills", response_model=list[SkillOut])
def list_skills(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return db.scalars(
        select(Skill).where(Skill.user_id == user.id).order_by(Skill.name)
    ).all()


@router.post("/skills", response_model=SkillDetail, status_code=201)
def create_skill(
    body: SkillCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skill = Skill(
        user_id=user.id,
        name=body.name,
        description=body.description or None,
        content=body.content,
    )
    db.add(skill)
    _commit_unique(db)
    return skill


@router.get("/skills/{skill_id}", response_model=SkillDetail)
def read_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _own(db, user, skill_id)


@router.patch("/skills/{skill_id}", response_model=SkillDetail)
def update_skill(
    skill_id: int,
    body: SkillUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    skill = _own(db, user, skill_id)
    if body.name is not None:
        skill.name = body.name
    if "description" in body.model_fields_set:
        skill.description = body.description or None
    if body.content is not None:
        skill.content = body.content
    _commit_unique(db)
    _sync_projects(db, _projects_using(db, skill.id), tools)
    return skill


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    skill = _own(db, user, skill_id)
    projects = _projects_using(db, skill.id)
    db.delete(skill)
    db.commit()
    _sync_projects(db, projects, tools)
    return Response(status_code=204)


def _project_skills(db: Session, project_id: int) -> list[ProjectSkillOut]:
    rows = db.execute(
        select(ProjectSkill, Skill)
        .join(Skill, Skill.id == ProjectSkill.skill_id)
        .where(ProjectSkill.project_id == project_id)
        .order_by(ProjectSkill.stage_key, ProjectSkill.position)
    )
    return [
        ProjectSkillOut(
            stage_key=link.stage_key,
            skill_id=skill.id,
            name=skill.name,
            description=skill.description,
            position=link.position,
        )
        for link, skill in rows
    ]


@router.get(
    "/projects/{project_id}/skills", response_model=list[ProjectSkillOut]
)
def list_project_skills(
    access: ProjectAccess = can_view_project, db: Session = Depends(get_db)
):
    return _project_skills(db, access.project.id)


@router.put(
    "/projects/{project_id}/skills/{stage_key}",
    response_model=list[ProjectSkillOut],
)
def set_stage_skills(
    stage_key: SkillScope,
    body: ProjectSkillsUpdate,
    access: ProjectAccess = can_edit_project,
    db: Session = Depends(get_db),
    tools: EnvironmentTools = Depends(environment_tools),
):
    if len(set(body.skill_ids)) != len(body.skill_ids):
        raise AppError(400, "duplicate_skills")
    attached = select(ProjectSkill.skill_id).where(
        ProjectSkill.project_id == access.project.id
    )
    usable = db.scalar(
        select(func.count()).where(
            Skill.id.in_(body.skill_ids),
            or_(Skill.user_id == access.user.id, Skill.id.in_(attached)),
        )
    )
    if usable != len(body.skill_ids):
        raise AppError(404, "skill_not_found")
    db.execute(
        delete(ProjectSkill).where(
            ProjectSkill.project_id == access.project.id,
            ProjectSkill.stage_key == stage_key.value,
        )
    )
    for position, skill_id in enumerate(body.skill_ids):
        db.add(
            ProjectSkill(
                project_id=access.project.id,
                skill_id=skill_id,
                stage_key=stage_key.value,
                position=position,
            )
        )
    db.commit()
    sync_agent_files(db, access.project, tools)
    return _project_skills(db, access.project.id)
