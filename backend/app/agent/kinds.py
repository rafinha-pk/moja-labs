import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Kind:
    tools: str
    allowed: tuple[str, ...]
    system: str
    schema: str | None = None


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
                    },
                    "required": ["title", "description"],
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
            "session. Order the tasks by implementation order and write in "
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
}
