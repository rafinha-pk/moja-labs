from dataclasses import dataclass

from app.environments.docker import Docker, DockerError

LOG_TAIL = 8000


@dataclass(frozen=True)
class Job:
    name: str

    @property
    def pid_file(self) -> str:
        return f"/tmp/moja-{self.name}.pid"

    @property
    def log_file(self) -> str:
        return f"/tmp/moja-{self.name}.log"

    @property
    def start_script(self) -> str:
        return (
            f"echo $$ > {self.pid_file}; "
            f'exec sh -c "$MOJA_RUN_COMMAND" > {self.log_file} 2>&1'
        )

    @property
    def stop_script(self) -> str:
        return f"""pid=$(cat {self.pid_file} 2>/dev/null) || exit 0
kill_tree() {{
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null
}}
kill_tree "$pid"
rm -f {self.pid_file}
"""


RUN = Job("run")
BUILD = Job("build")


def is_running(docker: Docker, container: str, job: Job = RUN) -> bool:
    try:
        docker.run(
            "exec", container, "sh", "-c", f"kill -0 $(cat {job.pid_file})"
        )
    except DockerError:
        return False
    return True


def start(
    docker: Docker, container: str, command: str, job: Job = RUN
) -> None:
    docker.run("start", container)
    docker.run(
        "exec",
        "-d",
        "-e",
        f"MOJA_RUN_COMMAND={command}",
        container,
        "sh",
        "-c",
        job.start_script,
    )


def stop(docker: Docker, container: str, job: Job = RUN) -> None:
    docker.run("exec", container, "sh", "-c", job.stop_script)


def read_log(docker: Docker, container: str, job: Job = RUN) -> str:
    try:
        return docker.run(
            "exec",
            container,
            "sh",
            "-c",
            f"tail -c {LOG_TAIL} {job.log_file} 2>/dev/null || true",
        )
    except DockerError:
        return ""


def read_file(docker: Docker, container: str, path: str) -> str | None:
    try:
        return docker.run(
            "exec", container, "sh", "-c", f"cat {path} 2>/dev/null"
        )
    except DockerError:
        return None
