import os
import shlex
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file(Path(__file__).resolve().parent.parent / ".env")


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    test_database_url: str | None
    jwt_secret: str
    encryption_key: str
    access_token_minutes: int
    refresh_token_days: int
    cors_origins: list[str]
    workspaces_dir: Path
    docker_command: list[str]
    claude_command: list[str]
    agent_model: str
    agent_effort: str
    agent_timeout_seconds: int
    project_port_base: int


def _default_docker_command() -> str:
    return (
        "wsl.exe -d Ubuntu-24.04 --exec docker"
        if os.name == "nt"
        else "docker"
    )


def load_settings() -> Settings:
    origins = os.environ.get("CORS_ORIGINS", "")
    return Settings(
        database_url=_required("DATABASE_URL"),
        test_database_url=os.environ.get("TEST_DATABASE_URL"),
        jwt_secret=_required("JWT_SECRET"),
        encryption_key=_required("ENCRYPTION_KEY"),
        access_token_minutes=int(os.environ.get("ACCESS_TOKEN_MINUTES", "15")),
        refresh_token_days=int(os.environ.get("REFRESH_TOKEN_DAYS", "14")),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        workspaces_dir=Path(
            os.environ.get("WORKSPACES_DIR")
            or Path(__file__).resolve().parents[2] / "projetos"
        ),
        docker_command=shlex.split(
            os.environ.get("DOCKER_COMMAND") or _default_docker_command()
        ),
        claude_command=shlex.split(os.environ.get("CLAUDE_COMMAND", "claude")),
        agent_model=os.environ.get("AGENT_MODEL", "claude-sonnet-5-5"),
        agent_effort=os.environ.get("AGENT_EFFORT", "medium"),
        agent_timeout_seconds=int(
            os.environ.get("AGENT_TIMEOUT_SECONDS", "1800")
        ),
        project_port_base=int(os.environ.get("PROJECT_PORT_BASE", "21000")),
    )


settings = load_settings()
