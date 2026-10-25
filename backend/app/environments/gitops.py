import base64
from dataclasses import dataclass

from app.environments.docker import Docker

DIFF_LIMIT = 100_000


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
