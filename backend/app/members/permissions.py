from enum import StrEnum


class Role(StrEnum):
    OWNER = "owner"
    PO = "po"
    DEV = "dev"


class Specialty(StrEnum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    FULLSTACK = "fullstack"


AREAS = tuple(item.value for item in Specialty)


def allowed_areas(specialty: str) -> frozenset[str]:
    if specialty == Specialty.FULLSTACK.value:
        return frozenset(AREAS)
    return frozenset({specialty})


class Permission(StrEnum):
    PROJECT_VIEW = "project.view"
    PROJECT_EDIT = "project.edit"
    PROJECT_DELETE = "project.delete"
    PLANNING_EDIT = "planning.edit"
    CODE_READ = "code.read"
    CODE_WRITE = "code.write"
    MEMBERS_VIEW = "members.view"
    MEMBERS_MANAGE = "members.manage"
    INTEGRATIONS_MANAGE = "integrations.manage"


ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OWNER: frozenset(Permission),
    Role.PO: frozenset(
        {
            Permission.PROJECT_VIEW,
            Permission.PROJECT_EDIT,
            Permission.PLANNING_EDIT,
            Permission.MEMBERS_VIEW,
        }
    ),
    Role.DEV: frozenset(
        {
            Permission.PROJECT_VIEW,
            Permission.PLANNING_EDIT,
            Permission.CODE_READ,
            Permission.CODE_WRITE,
            Permission.MEMBERS_VIEW,
        }
    ),
}


def has_permission(role: str, permission: Permission) -> bool:
    try:
        return permission in ROLE_PERMISSIONS[Role(role)]
    except ValueError:
        return False
