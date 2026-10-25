import base64
from dataclasses import dataclass

from app.environments.docker import Docker, DockerError

DIFF_LIMIT = 100_000
DOC_PATHS = ("docs", "README.md")


def git_credentials(token: str) -> tuple[dict[str, str], tuple[str, str]]:
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    env = {
        "GIT_CONFIG_COUNT": "1",
        "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
        "GIT_CONFIG_VALUE_0": f"Authorization: Basic {basic}",
    }
    return env, (token, basic)


def redact(text: str, secrets: tuple[str, ...]) -> str:
    for secret in secrets:
        text = text.replace(secret, "***")
    return text


@dataclass
class Change:
    status: str
    path: str


@dataclass
class Commit:
    hash: str
    subject: str


@dataclass
class HistoryEntry:
    hash: str
    author: str
    when: str
    subject: str


class Repo:
    def __init__(self, docker: Docker, container: str):
        self.docker = docker
        self.container = container

    def git(
        self,
        *args: str,
        credentials: dict[str, str] | None = None,
        timeout: int = 300,
    ) -> str:
        flags = [part for name in credentials or () for part in ("-e", name)]
        return self.docker.run(
            "exec",
            *flags,
            self.container,
            "git",
            *args,
            env=credentials,
            timeout=timeout,
        )

    def turn_on(self) -> None:
        self.docker.run("start", self.container)

    def branch(self) -> str:
        return self.git("symbolic-ref", "--short", "HEAD")

    def changes(self) -> list[Change]:
        found = []
        for line in self.git("status", "--porcelain", "-uall").splitlines():
            status, _, path = line.strip().partition(" ")
            found.append(Change(status, path.strip()))
        return found

    def diff(self) -> str:
        self.git("add", "-N", ".")
        return self.git("diff", "HEAD")[:DIFF_LIMIT]

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-m", message)

    def push(self, credentials: dict[str, str]) -> None:
        self.git("push", "origin", "HEAD", credentials=credentials)

    def unpushed(self) -> list[Commit]:
        lines = self.git(
            "log", "--format=%h%x09%s", "HEAD", "--not", "--remotes"
        ).splitlines()
        return [Commit(*line.split("\t", 1)) for line in lines if "\t" in line]

    def head(self) -> str | None:
        try:
            return self.git("rev-parse", "HEAD")
        except DockerError:
            return None

    def knows(self, commit: str) -> bool:
        try:
            self.git("cat-file", "-e", f"{commit}^{{commit}}")
        except DockerError:
            return False
        return True

    def docs_dirty(self) -> bool:
        return bool(self.git("status", "--porcelain", "--", *DOC_PATHS))

    def docs_files(self, base: str) -> list[str]:
        names = self.git("diff", "--name-only", base, "HEAD", "--", *DOC_PATHS)
        return [name for name in names.splitlines() if name]

    def docs_diff(self, base: str) -> str:
        return self.git("diff", base, "HEAD", "--", *DOC_PATHS)[:DIFF_LIMIT]

    def history(self, limit: int = 20) -> list[HistoryEntry]:
        lines = self.git(
            "log", "-n", str(limit), "--format=%h%x09%an%x09%ar%x09%s"
        ).splitlines()
        entries = []
        for line in lines:
            parts = line.split("\t", 3)
            if len(parts) == 4:
                entries.append(HistoryEntry(*parts))
        return entries
