from app.projects.models import Project

WEB_GITIGNORE = """.env
.env.*
!.env.example
.venv/
__pycache__/
*.pyc
.pytest_cache/
node_modules/
dist/
.DS_Store
"""


def _readme(project: Project) -> str:
    description = f"\n{project.description}\n" if project.description else ""
    return f"# {project.name}\n{description}"


def starter_files(project: Project) -> list[tuple[str, str, str]]:
    files = [("README.md", _readme(project), "Initial commit")]
    if project.type == "web":
        files.append((".gitignore", WEB_GITIGNORE, "Add .gitignore"))
    return files
