import hashlib
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.environments.agent_files import (
    exclude_locally,
    slugify,
    write_agent_files,
)
from app.environments.docker import DockerError, to_docker_path
from app.environments.gitops import git_credentials, redact
from app.environments.models import EnvironmentStatus, ProjectEnvironment
from app.environments.tools import EnvironmentTools
from app.github.models import ProjectRepository
from app.github.service import resolve_credential, usable_token
from app.projects.models import Project

TEMPLATES = Path(__file__).parent / "templates"
MOBILE = "mobile"
WEB_MEMORY = "4g"
SCAFFOLD_TIMEOUT = 1800
MOBILE_VOLUMES = (
    ("moja-gradle-cache", "/home/dev/.gradle"),
    ("moja-npm-cache", "/home/dev/.npm"),
    ("moja-android-sdk", "/opt/android-sdk"),
)
LOG_LIMIT = 20000
BUILD_TIMEOUT = 1800


def container_name(project_id: int) -> str:
    return f"moja-p{project_id}"


def dockerfile_for(project_type: str) -> Path:
    kind = MOBILE if project_type == MOBILE else "web"
    return TEMPLATES / kind / "Dockerfile"


def image_tag(project_type: str = "web") -> str:
    kind = MOBILE if project_type == MOBILE else "web"
    digest = hashlib.sha256(
        dockerfile_for(project_type).read_bytes()
    ).hexdigest()[:10]
    return f"moja-{kind}-dev:{digest}"


def suggest_package(login: str, name: str) -> str:
    def clean(text: str, fallback: str) -> str:
        value = "".join(
            ch for ch in text.lower() if ch.isalnum() and ch.isascii()
        )
        if not value or not value[0].isalpha():
            value = f"{fallback}{value}"
        return value

    return f"com.{clean(login, 'u')}.{clean(name, 'app')}"


SET_PACKAGE = (
    "node -e \"const fs=require('fs');const j=JSON.parse("
    "fs.readFileSync('app.json','utf8'));j.expo=j.expo||{};"
    "j.expo.android=Object.assign({},j.expo.android,{package:"
    "process.env.MOJA_ANDROID_PACKAGE});fs.writeFileSync('app.json',"
    "JSON.stringify(j,null,2)+'\\n')\""
)
EXPO_WEB_COMMAND = "cd frontend && CI=1 npx expo start --web --port $PORT"


class BuildError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class _Job:
    def __init__(
        self,
        db: Session,
        project: Project,
        repository: ProjectRepository,
        row: ProjectEnvironment,
        token: str,
        login: str,
        tools: EnvironmentTools,
    ):
        self.db = db
        self.project = project
        self.repository = repository
        self.row = row
        self.token = token
        self.login = login
        self.tools = tools
        self.container = container_name(project.id)
        self.mobile = project.type == MOBILE
        self.image = image_tag(project.type)
        self.port = tools.port_base + project.id
        self.branch = "main"
        self.credentials, self.secrets = git_credentials(token)

    def log(self, text: str) -> None:
        text = redact(text, self.secrets)
        self.row.log = (self.row.log + text + "\n")[-LOG_LIMIT:]
        self.db.commit()

    def docker(self, *args: str, code: str, **options) -> str:
        try:
            return self.tools.docker.run(*args, **options)
        except DockerError as error:
            self.log(error.output or str(error))
            raise BuildError(code) from None

    def git(
        self,
        *args: str,
        code: str = "git_failed",
        credentials: bool = False,
        timeout: int = 300,
    ) -> str:
        env = self.credentials if credentials else None
        flags = [part for name in env or () for part in ("-e", name)]
        return self.docker(
            "exec",
            *flags,
            self.container,
            "git",
            *args,
            code=code,
            env=env,
            timeout=timeout,
        )

    def workspace(self) -> Path:
        name = f"{self.project.id}-{slugify(self.project.name, 'projeto')}"
        path = self.tools.workspaces / name
        path.mkdir(parents=True, exist_ok=True)
        return path

    def ensure_image(self) -> None:
        try:
            self.tools.docker.run("image", "inspect", self.image)
        except DockerError:
            self.log("Building the image (first time only)")
            self.docker(
                "build",
                "--target",
                "dev",
                "-t",
                self.image,
                "-",
                code="build_failed",
                stdin=dockerfile_for(self.project.type).read_text(
                    encoding="utf-8"
                ),
                timeout=BUILD_TIMEOUT,
            )
        else:
            self.log("Image already built")

    def start_container(self, workspace: Path) -> None:
        self.log("Starting the container")
        try:
            self.tools.docker.run("rm", "-f", self.container)
        except DockerError:
            pass
        self.docker(
            "run",
            "-d",
            "--name",
            self.container,
            "--label",
            f"moja.project={self.project.id}",
            "--cpus",
            "2",
            "--memory",
            self.tools.mobile_memory if self.mobile else WEB_MEMORY,
            "--pids-limit",
            "1024",
            "--security-opt",
            "no-new-privileges",
            "-u",
            "1000:1000",
            "-v",
            f"{to_docker_path(workspace)}:/workspace",
            *self.mobile_volumes(),
            "-w",
            "/workspace",
            "-p",
            f"{self.tools.bind_address}:{self.port}:{self.port}",
            "-e",
            f"PORT={self.port}",
            self.image,
            code="container_failed",
        )
        if self.mobile:
            paths = [path for _, path in self.volume_list()]
            self.docker(
                "exec",
                "-u",
                "root",
                self.container,
                "chown",
                "1000:1000",
                *paths,
                code="container_failed",
            )

    def volume_list(self) -> list[tuple[str, str]]:
        return [
            *MOBILE_VOLUMES,
            (
                f"moja-p{self.project.id}-nm",
                "/workspace/frontend/node_modules",
            ),
        ]

    def mobile_volumes(self) -> list[str]:
        if not self.mobile:
            return []
        return [
            part
            for name, path in self.volume_list()
            for part in ("-v", f"{name}:{path}")
        ]

    def scaffold_mobile(self, workspace: Path) -> None:
        if (workspace / "frontend" / "package.json").exists():
            return
        self.log("Creating the Expo app (this can take a few minutes)")
        package = self.project.android_package or suggest_package(
            self.login, self.project.name
        )
        self.project.android_package = package
        script = (
            "set -e; cd /tmp && rm -rf scaffold && "
            "npx --yes create-expo-app@latest scaffold "
            "--template blank-typescript --no-install && "
            "mkdir -p /workspace/frontend && "
            "tar -C scaffold --exclude=./node_modules --exclude=./.git "
            "--exclude=./AGENTS.md --exclude=./LICENSE -cf - . | "
            "tar -C /workspace/frontend -xf - && "
            "cd /workspace/frontend && "
            + SET_PACKAGE
            + " && npm install --no-audit --no-fund"
            + " && npx expo install react-dom react-native-web"
        )
        self.docker(
            "exec",
            "-e",
            f"MOJA_ANDROID_PACKAGE={package}",
            self.container,
            "sh",
            "-c",
            script,
            code="scaffold_failed",
            timeout=SCAFFOLD_TIMEOUT,
        )
        if not self.project.run_command:
            self.project.run_command = EXPO_WEB_COMMAND

    def configure_git(self) -> None:
        self.git("config", "--global", "--add", "safe.directory", "/workspace")
        self.git("config", "--global", "user.name", self.login)
        self.git(
            "config",
            "--global",
            "user.email",
            f"{self.login}@users.noreply.github.com",
        )

    def sync_repository(self, workspace: Path) -> None:
        self.log("Syncing the repository")
        if not (workspace / ".git").exists():
            self.git("init", "-b", "main")
        try:
            self.git("remote", "remove", "origin")
        except BuildError:
            pass
        url = f"https://github.com/{self.repository.full_name}.git"
        self.git("remote", "add", "origin", url)
        head = self.git(
            "ls-remote",
            "--symref",
            "origin",
            "HEAD",
            credentials=True,
            code="git_remote_failed",
        )
        for line in head.splitlines():
            if line.startswith("ref: refs/heads/"):
                self.branch = line.split("\t")[0].removeprefix(
                    "ref: refs/heads/"
                )
        if head:
            self.git(
                "fetch",
                "origin",
                f"+refs/heads/{self.branch}:refs/remotes/origin/{self.branch}",
                credentials=True,
                code="git_remote_failed",
            )
            self.git(
                "checkout", "-f", "-B", self.branch, f"origin/{self.branch}"
            )
        exclude_locally(workspace)
        self.git(
            "rm", "-r", "--cached", "--ignore-unmatch", "-q", "--", "docs"
        )

    def run(self) -> None:
        self.log("Checking Docker")
        self.docker(
            "version",
            "--format",
            "{{.Server.Version}}",
            code="docker_unavailable",
        )
        workspace = self.workspace()
        self.row.workspace = str(workspace)
        self.ensure_image()
        self.start_container(workspace)
        self.configure_git()
        self.sync_repository(workspace)
        if self.mobile:
            self.scaffold_mobile(workspace)
        write_agent_files(
            self.db,
            self.project,
            workspace,
            self.container,
            " ".join(self.tools.docker.command),
        )
        versions = self.docker(
            "exec",
            self.container,
            "sh",
            "-c",
            "node --version && java -version 2>&1 | head -1 && git --version"
            if self.mobile
            else "python --version && node --version && git --version",
            code="container_failed",
        )
        self.log(versions)
        self.row.container = self.container
        self.row.port = self.port
        self.row.image = self.image
        self.row.status = EnvironmentStatus.READY.value
        self.row.error_code = None
        self.log("Environment ready")


def _fail(row: ProjectEnvironment, code: str, message: str = "") -> None:
    row.status = EnvironmentStatus.FAILED.value
    row.error_code = code
    if message:
        row.log = (row.log + message + "\n")[-LOG_LIMIT:]


def build_environment(
    bind: Engine, project_id: int, tools: EnvironmentTools
) -> None:
    with Session(bind) as db:
        row = db.scalar(
            select(ProjectEnvironment).where(
                ProjectEnvironment.project_id == project_id
            )
        )
        project = db.get(Project, project_id)
        repository = db.scalar(
            select(ProjectRepository).where(
                ProjectRepository.project_id == project_id
            )
        )
        try:
            token = usable_token(db, project)
            login = resolve_credential(db, project)[0].login
            _Job(db, project, repository, row, token, login, tools).run()
        except BuildError as failure:
            _fail(row, failure.code)
        except Exception as error:
            _fail(row, "unexpected_error", f"{type(error).__name__}: {error}")
        db.commit()
