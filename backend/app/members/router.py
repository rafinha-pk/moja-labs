from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.ratelimit import invite_limiter
from app.clock import utcnow
from app.db import get_db
from app.errors import AppError
from app.members.access import (
    ProjectAccess,
    can_manage_members,
    can_view_members,
)
from app.members.models import InviteStatus, ProjectInvite, ProjectMember
from app.members.permissions import Permission, Role, has_permission
from app.members.schemas import (
    InviteCreate,
    InviteOut,
    MemberOut,
    RoleUpdate,
    TransferOwnership,
)
from app.projects.models import Project
from app.users.models import User

router = APIRouter(tags=["members"])


def _invite_out(
    invite: ProjectInvite, project_name: str, inviter_name: str
) -> InviteOut:
    return InviteOut(
        id=invite.id,
        project_id=invite.project_id,
        project_name=project_name,
        email=invite.email,
        role=invite.role,
        invited_by_name=inviter_name,
        status=invite.status,
        created_at=invite.created_at,
    )


def _get_member(db: Session, project_id: int, user_id: int) -> ProjectMember:
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if member is None:
        raise AppError(404, "member_not_found")
    return member


@router.get("/projects/{project_id}/members", response_model=list[MemberOut])
def list_members(
    access: ProjectAccess = can_view_members,
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == access.project.id)
        .order_by(ProjectMember.created_at, ProjectMember.id)
    ).all()
    return [
        MemberOut(
            user_id=u.id,
            email=u.email,
            name=u.name,
            role=m.role,
            joined_at=m.created_at,
        )
        for m, u in rows
    ]


@router.patch(
    "/projects/{project_id}/members/{user_id}", response_model=MemberOut
)
def change_member_role(
    user_id: int,
    body: RoleUpdate,
    access: ProjectAccess = can_manage_members,
    db: Session = Depends(get_db),
):
    member = _get_member(db, access.project.id, user_id)
    if member.role == Role.OWNER.value:
        raise AppError(409, "cannot_change_owner_role")
    member.role = body.role
    db.commit()
    user = db.get(User, user_id)
    return MemberOut(
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=member.role,
        joined_at=member.created_at,
    )


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    user_id: int,
    access: ProjectAccess = can_view_members,
    db: Session = Depends(get_db),
):
    if user_id != access.user.id and not has_permission(
        access.role, Permission.MEMBERS_MANAGE
    ):
        raise AppError(403, "forbidden")
    member = _get_member(db, access.project.id, user_id)
    if member.role == Role.OWNER.value:
        raise AppError(409, "cannot_remove_owner")
    db.delete(member)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/projects/{project_id}/transfer-ownership", response_model=MemberOut
)
def transfer_ownership(
    body: TransferOwnership,
    access: ProjectAccess = can_manage_members,
    db: Session = Depends(get_db),
):
    if body.user_id == access.project.owner_id:
        raise AppError(400, "invalid_transfer_target")
    new_owner = _get_member(db, access.project.id, body.user_id)
    current_owner = _get_member(db, access.project.id, access.project.owner_id)
    current_owner.role = body.previous_owner_role
    new_owner.role = Role.OWNER.value
    access.project.owner_id = body.user_id
    db.commit()
    user = db.get(User, body.user_id)
    return MemberOut(
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=new_owner.role,
        joined_at=new_owner.created_at,
    )


@router.get("/projects/{project_id}/invites", response_model=list[InviteOut])
def list_project_invites(
    access: ProjectAccess = can_manage_members,
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(ProjectInvite, User.name)
        .join(User, User.id == ProjectInvite.invited_by)
        .where(
            ProjectInvite.project_id == access.project.id,
            ProjectInvite.status == InviteStatus.PENDING.value,
        )
        .order_by(ProjectInvite.created_at.desc(), ProjectInvite.id.desc())
    ).all()
    return [
        _invite_out(invite, access.project.name, inviter)
        for invite, inviter in rows
    ]


@router.post(
    "/projects/{project_id}/invites", response_model=InviteOut, status_code=201
)
def create_invite(
    body: InviteCreate,
    access: ProjectAccess = can_manage_members,
    db: Session = Depends(get_db),
):
    key = f"invite:{access.user.id}"
    if invite_limiter.is_blocked(key):
        raise AppError(429, "too_many_attempts")
    invite_limiter.hit(key)

    invitee = db.scalar(
        select(User).where(User.email == body.email, User.is_active.is_(True))
    )
    if invitee is None:
        raise AppError(404, "user_not_found")

    already_member = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == access.project.id,
            ProjectMember.user_id == invitee.id,
        )
    )
    if already_member is not None:
        raise AppError(409, "already_member")

    already_invited = db.scalar(
        select(ProjectInvite.id).where(
            ProjectInvite.project_id == access.project.id,
            ProjectInvite.email == body.email,
            ProjectInvite.status == InviteStatus.PENDING.value,
        )
    )
    if already_invited is not None:
        raise AppError(409, "invite_already_pending")

    invite = ProjectInvite(
        project_id=access.project.id,
        email=body.email,
        role=body.role,
        invited_by=access.user.id,
    )
    db.add(invite)
    db.commit()
    return _invite_out(invite, access.project.name, access.user.name)


@router.delete("/projects/{project_id}/invites/{invite_id}", status_code=204)
def cancel_invite(
    invite_id: int,
    access: ProjectAccess = can_manage_members,
    db: Session = Depends(get_db),
):
    invite = db.get(ProjectInvite, invite_id)
    if (
        invite is None
        or invite.project_id != access.project.id
        or invite.status != InviteStatus.PENDING.value
    ):
        raise AppError(404, "invite_not_found")
    invite.status = InviteStatus.CANCELLED.value
    invite.responded_at = utcnow()
    db.commit()
    return Response(status_code=204)


@router.get("/invites", response_model=list[InviteOut])
def list_my_invites(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    inviter = User.__table__.alias("inviter")
    rows = db.execute(
        select(ProjectInvite, Project.name, inviter.c.name)
        .join(Project, Project.id == ProjectInvite.project_id)
        .join(inviter, inviter.c.id == ProjectInvite.invited_by)
        .where(
            ProjectInvite.email == user.email,
            ProjectInvite.status == InviteStatus.PENDING.value,
        )
        .order_by(ProjectInvite.created_at.desc(), ProjectInvite.id.desc())
    ).all()
    return [
        _invite_out(invite, project_name, inviter_name)
        for invite, project_name, inviter_name in rows
    ]


def _pending_invite_for(
    db: Session, invite_id: int, user: User
) -> ProjectInvite:
    invite = db.get(ProjectInvite, invite_id)
    if (
        invite is None
        or invite.email != user.email
        or invite.status != InviteStatus.PENDING.value
    ):
        raise AppError(404, "invite_not_found")
    return invite


@router.post("/invites/{invite_id}/accept", response_model=InviteOut)
def accept_invite(
    invite_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite = _pending_invite_for(db, invite_id, user)
    already_member = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == invite.project_id,
            ProjectMember.user_id == user.id,
        )
    )
    if already_member is None:
        db.add(
            ProjectMember(
                project_id=invite.project_id, user_id=user.id, role=invite.role
            )
        )
    invite.status = InviteStatus.ACCEPTED.value
    invite.responded_at = utcnow()
    db.commit()
    project = db.get(Project, invite.project_id)
    inviter = db.get(User, invite.invited_by)
    return _invite_out(invite, project.name, inviter.name)


@router.post("/invites/{invite_id}/decline", response_model=InviteOut)
def decline_invite(
    invite_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite = _pending_invite_for(db, invite_id, user)
    invite.status = InviteStatus.DECLINED.value
    invite.responded_at = utcnow()
    db.commit()
    project = db.get(Project, invite.project_id)
    inviter = db.get(User, invite.invited_by)
    return _invite_out(invite, project.name, inviter.name)
