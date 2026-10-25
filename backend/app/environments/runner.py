from app.environments.docker import Docker, DockerError

PID_FILE = "/tmp/moja-run.pid"
LOG_FILE = "/tmp/moja-run.log"
LOG_TAIL = 8000

START_SCRIPT = (
    f'echo $$ > {PID_FILE}; exec sh -c "$MOJA_RUN_COMMAND" > {LOG_FILE} 2>&1'
)
STOP_SCRIPT = f"""pid=$(cat {PID_FILE} 2>/dev/null) || exit 0
kill_tree() {{
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null
}}
kill_tree "$pid"
rm -f {PID_FILE}
"""


def is_running(docker: Docker, container: str) -> bool:
    try:
        docker.run("exec", container, "sh", "-c", f"kill -0 $(cat {PID_FILE})")
    except DockerError:
        return False
    return True


def start(docker: Docker, container: str, command: str) -> None:
    docker.run("start", container)
    docker.run(
        "exec",
        "-d",
        "-e",
        f"MOJA_RUN_COMMAND={command}",
        container,
        "sh",
        "-c",
        START_SCRIPT,
    )


def stop(docker: Docker, container: str) -> None:
    docker.run("exec", container, "sh", "-c", STOP_SCRIPT)


def read_log(docker: Docker, container: str) -> str:
    try:
        return docker.run(
            "exec",
            container,
            "sh",
            "-c",
            f"tail -c {LOG_TAIL} {LOG_FILE} 2>/dev/null || true",
        )
    except DockerError:
        return ""
