import os
import subprocess
from pathlib import Path


class DockerError(Exception):
    def __init__(self, message: str, output: str = ""):
        super().__init__(message)
        self.output = output


def to_docker_path(path: Path) -> str:
    if os.name != "nt":
        return path.as_posix()
    drive, rest = os.path.splitdrive(str(path))
    return f"/mnt/{drive.rstrip(':').lower()}{rest.replace(chr(92), '/')}"


class Docker:
    def __init__(self, command: list[str]):
        self.command = command

    def run(
        self,
        *args: str,
        stdin: str | None = None,
        env: dict[str, str] | None = None,
        timeout: int = 120,
    ) -> str:
        full_env = os.environ.copy()
        if env:
            full_env.update(env)
            forwarded = ":".join(env)
            current = full_env.get("WSLENV")
            full_env["WSLENV"] = (
                f"{current}:{forwarded}" if current else forwarded
            )
        try:
            result = subprocess.run(
                [*self.command, *args],
                input=stdin,
                env=full_env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise DockerError(type(error).__name__) from None
        output = (result.stdout + result.stderr).strip()
        if result.returncode != 0:
            raise DockerError(f"exit {result.returncode}", output)
        return result.stdout.strip()
