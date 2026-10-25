import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.environments.docker import Docker


class ThreadJobs:
    def submit(self, job: Callable[[], None]) -> None:
        threading.Thread(target=job, daemon=True).start()


@dataclass
class EnvironmentTools:
    docker: Docker
    jobs: ThreadJobs
    workspaces: Path
    claude_command: list[str]
    port_base: int
    agent_budget_usd: float = 3.0
    agent_timeout_seconds: int = 1800


def environment_tools() -> EnvironmentTools:
    return EnvironmentTools(
        docker=Docker(settings.docker_command),
        jobs=ThreadJobs(),
        workspaces=settings.workspaces_dir,
        claude_command=settings.claude_command,
        port_base=settings.project_port_base,
        agent_budget_usd=settings.agent_budget_usd,
        agent_timeout_seconds=settings.agent_timeout_seconds,
    )
