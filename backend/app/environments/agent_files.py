import json
import re
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.environments.models import EnvironmentStatus, ProjectEnvironment
from app.environments.tools import EnvironmentTools
from app.projects.models import Project
from app.skills.models import ProjectSkill, Skill

LOCAL_ONLY = ("CLAUDE.md", ".claude/", "docs/", ".moja/")


def slugify(text: str, fallback: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or fallback


def skill_slug(skill: Skill) -> str:
    return f"{slugify(skill.name, 'skill')}-{skill.id}"


def _project_skills(
    db: Session, project_id: int
) -> list[tuple[ProjectSkill, Skill]]:
    rows = db.execute(
        select(ProjectSkill, Skill)
        .join(Skill, Skill.id == ProjectSkill.skill_id)
        .where(ProjectSkill.project_id == project_id)
        .order_by(ProjectSkill.stage_key, ProjectSkill.position)
    )
    return [(link, skill) for link, skill in rows]


def claude_md(
    project: Project,
    links: list[tuple[ProjectSkill, Skill]],
    container: str,
    exec_prefix: str,
) -> str:
    lines = [f"# {project.name}", ""]
    if project.description:
        lines += [project.description, ""]
    lines += [
        "## Environment",
        "",
        f"This project runs in the Docker container `{container}` "
        "(workspace mounted at `/workspace`).",
        "Run every command that executes project code (python, pip, npm, "
        "node, tests) inside the container, never on the host:",
        "",
        f"    {exec_prefix} exec {container} <command>",
        "",
        "Use git for version control and work on a branch per task.",
    ]
    if project.type == "mobile":
        lines += [
            "",
            "## Layout",
            "",
            "This is an Android-only app made with Expo (React Native and "
            "TypeScript). The whole app lives in `frontend/` and the "
            "documentation in `docs/`. There is no back-end in this "
            "project: if the app needs a server, it is another project. "
            "Preview the app in the browser with Expo web (`npx expo "
            "start --web`). Do not build the APK yourself or run `expo "
            "prebuild`: the user generates the APK with a button in "
            "Moja Labs.",
        ]
    if project.type == "web":
        lines += [
            "",
            "## Layout",
            "",
            "Every web project follows one layout: back-end code in "
            "`backend/`, front-end code in `frontend/` and documentation in "
            "`docs/`. Keep new code inside those folders.",
        ]
    if links:
        lines += [
            "",
            "## Skills by stage",
            "",
            "Use the skills listed for the current stage (invoke them with "
            "the Skill tool). Stages: `docs` (documentation), `planning` "
            "(searching and refining tasks) and `execution` (running a "
            "task).",
            "",
        ]
        for stage in dict.fromkeys(link.stage_key for link, _ in links):
            names = ", ".join(
                f"`{skill_slug(skill)}`"
                for link, skill in links
                if link.stage_key == stage
            )
            lines.append(f"- {stage}: {names}")
    return "\n".join(lines) + "\n"


def skill_md(skill: Skill) -> str:
    description = " ".join((skill.description or skill.name).split())
    return (
        f"---\nname: {skill_slug(skill)}\n"
        f"description: {json.dumps(description)}\n---\n\n{skill.content}\n"
    )


def write_agent_files(
    db: Session,
    project: Project,
    workspace: Path,
    container: str,
    exec_prefix: str,
) -> None:
    links = _project_skills(db, project.id)
    (workspace / "CLAUDE.md").write_text(
        claude_md(project, links, container, exec_prefix), encoding="utf-8"
    )
    skills_dir = workspace / ".claude" / "skills"
    shutil.rmtree(skills_dir, ignore_errors=True)
    for skill in {skill.id: skill for _, skill in links}.values():
        target = skills_dir / skill_slug(skill)
        target.mkdir(parents=True)
        (target / "SKILL.md").write_text(skill_md(skill), encoding="utf-8")


def sync_agent_files(
    db: Session, project: Project, tools: EnvironmentTools
) -> None:
    environment = db.scalar(
        select(ProjectEnvironment).where(
            ProjectEnvironment.project_id == project.id
        )
    )
    if (
        environment is None
        or environment.status != EnvironmentStatus.READY.value
        or not environment.workspace
        or not environment.container
    ):
        return
    write_agent_files(
        db,
        project,
        Path(environment.workspace),
        environment.container,
        " ".join(tools.docker.command),
    )


def exclude_locally(workspace: Path) -> None:
    exclude = workspace / ".git" / "info" / "exclude"
    exclude.parent.mkdir(parents=True, exist_ok=True)
    current = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
    missing = [line for line in LOCAL_ONLY if line not in current.split()]
    if missing:
        exclude.write_text(
            current.rstrip("\n") + "\n" + "\n".join(missing) + "\n",
            encoding="utf-8",
        )
