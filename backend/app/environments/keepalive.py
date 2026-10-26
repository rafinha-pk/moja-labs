import subprocess
from pathlib import Path


def keepalive_command(docker_command: list[str]) -> list[str] | None:
    if not docker_command or Path(docker_command[0]).stem.lower() != "wsl":
        return None
    if "--exec" not in docker_command:
        return None
    index = docker_command.index("--exec")
    return [*docker_command[: index + 1], "sleep", "infinity"]


def start_keepalive(docker_command: list[str]) -> subprocess.Popen | None:
    command = keepalive_command(docker_command)
    if command is None:
        return None
    try:
        return subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return None


def stop_keepalive(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
