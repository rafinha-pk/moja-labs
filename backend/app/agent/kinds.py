import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Kind:
    tools: str
    allowed: tuple[str, ...]
    system: str
    schema: str | None = None
    shell: bool = False


AREA_FOLDERS = {"frontend": "frontend", "backend": "backend"}
SHARED_PATHS = ("docs", "README.md")


def write_rules(scope: str | None) -> tuple[str, ...]:
    if scope not in AREA_FOLDERS:
        return ("Write", "Edit")
    folders = [f"{AREA_FOLDERS[scope]}/**", "docs/**", "README.md"]
    return tuple(
        f"{tool}({folder})" for folder in folders for tool in ("Write", "Edit")
    )


def scope_note(scope: str | None) -> str:
    if scope not in AREA_FOLDERS:
        return ""
    folder = AREA_FOLDERS[scope]
    return (
        f" You work as a {scope} developer: you may only create or change "
        f"files under {folder}/, under docs/ and README.md. This also "
        "applies to commands you run in the container: never write "
        "anywhere else. If the task needs a change elsewhere, say so in "
        "your summary instead of doing it."
    )


TASKS_SCHEMA = json.dumps(
    {
        "type": "object",
        "properties": {
            "message": {"type": "string"},
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "area": {
                            "type": "string",
                            "enum": ["frontend", "backend", "fullstack"],
                        },
                    },
                    "required": ["title", "description", "area"],
                },
            },
        },
        "required": ["message", "tasks"],
    }
)

COMMIT_SCHEMA = json.dumps(
    {
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"],
    }
)

KINDS = {
    "docs": Kind(
        tools="Read,Write,Edit,Glob,Grep,Skill",
        allowed=(
            "Read",
            "Glob",
            "Grep",
            "Skill",
            "Write(docs/**)",
            "Edit(docs/**)",
            "Write(README.md)",
            "Edit(README.md)",
        ),
        system=(
            "You are the documentation assistant of this project. Work only "
            "on documentation: create or update Markdown files under docs/ "
            "(and README.md when asked). Do not write source code. You have "
            "no shell and must not use git: the user reviews and commits "
            "your changes in Moja Labs. Write in the language of the user's "
            "request, keep the text objective and free of filler, and read "
            "the existing docs before changing them. If CLAUDE.md lists "
            "skills for the docs stage, use them; otherwise follow your own "
            "judgment. When something is unclear, assume the most "
            "reasonable option and list the open questions in "
            "docs/perguntas-abertas.md."
        ),
    ),
    "tasks": Kind(
        tools="Read,Glob,Grep,Skill",
        allowed=("Read", "Glob", "Grep", "Skill"),
        schema=TASKS_SCHEMA,
        system=(
            "You are the planner of this project. You are read-only: read "
            "docs/ and README.md (and the code, when useful) and propose the "
            "implementation tasks. Never edit files. Each task has a short "
            "title (at most 150 characters) and a description with what to "
            "do and the acceptance criteria, small enough for one coding "
            "session. Web projects keep the back-end in backend/ and the "
            "front-end in frontend/. Tag each task with its `area`: "
            "frontend, backend, or "
            "fullstack when it needs both. Order the tasks by implementation "
            "order and write in "
            "the language of the docs. If CLAUDE.md lists skills for the "
            "planning stage, use them. Always answer through the structured "
            "output: `message` is a short reply to the user and `tasks` is "
            "the COMPLETE list of NEW tasks you propose after applying the "
            "user's latest feedback. Never include tasks that already "
            "exist: they are listed in the request only so you avoid "
            "duplicating them."
        ),
    ),
    "commit": Kind(
        tools="Read,Glob,Grep",
        allowed=("Read", "Glob", "Grep"),
        schema=COMMIT_SCHEMA,
        system=(
            "You write git commit messages. You are read-only: use the "
            "diff you receive (and read files only if truly needed). "
            "Write an imperative subject line of at most 72 characters, "
            "then a blank line and a few short bullets when the change "
            "deserves them. Match the language and style of the recent "
            "commits you receive. Answer through the structured output: "
            "`message` is the full commit message."
        ),
    ),
    "task": Kind(
        tools="Read,Write,Edit,Glob,Grep,Skill,Bash",
        allowed=("Read", "Glob", "Grep", "Skill"),
        shell=True,
        system=(
            "You implement one task of this software project, working "
            "directly in the project folder. You may read and write any "
            "file of the project, including docs/. You have no general "
            "shell: run every command that executes project code "
            "(install, build, test, start) through the docker exec prefix "
            "given in CLAUDE.md, using relative paths (the container "
            "already starts in /workspace and the host shell rewrites "
            "absolute paths). Never use git to commit or push: the user "
            "reviews and commits in Moja Labs. If CLAUDE.md lists skills "
            "for the execution stage, use them. Prefer small, working "
            "changes, run the project's tests when they exist and finish "
            "with a short summary, in the user's language, of what "
            "changed, what you ran to check it and anything left."
        ),
    ),
}
