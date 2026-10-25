import json
import os
import subprocess
import threading
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.agent.kinds import KINDS
from app.agent.models import AgentRun, RunStatus
from app.clock import utcnow
from app.environments.service import current
from app.environments.tools import EnvironmentTools

LOG_LIMIT = 20000
PROCESSES: dict[int, subprocess.Popen] = {}


def build_command(
    tools: EnvironmentTools, kind_name: str, resume: str | None = None
) -> list[str]:
    kind = KINDS[kind_name]
    command = [
        *tools.claude_command,
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        tools.agent_model,
        "--effort",
        tools.agent_effort,
        "--permission-mode",
        "default",
        "--tools",
        kind.tools,
        "--allowedTools",
        *kind.allowed,
        "--append-system-prompt",
        kind.system,
        "--setting-sources",
        "project,local",
    ]
    if resume:
        command += ["--resume", resume]
    return command


def kill(process: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
        )
    else:
        process.kill()


def describe(event: dict, workspace: Path) -> str:
    if event.get("type") != "assistant":
        return ""
    lines = []
    for block in event.get("message", {}).get("content", []):
        if block.get("type") == "text":
            lines.append(block["text"].strip())
        elif block.get("type") == "tool_use":
            args = block.get("input", {})
            target = args.get("file_path") or args.get("pattern") or ""
            target = target.removeprefix(f"{workspace}{os.sep}")
            target = target.replace("\\", "/")
            lines.append(f"-> {block['name']} {target}".strip())
    return "\n".join(line for line in lines if line)


def _append(db: Session, run: AgentRun, text: str) -> None:
    run.log = (run.log + text + "\n")[-LOG_LIMIT:]
    db.commit()


def _stream(
    db: Session,
    run: AgentRun,
    workspace: Path,
    tools: EnvironmentTools,
    resume: str | None,
) -> tuple[dict, int, bool]:
    process = subprocess.Popen(
        build_command(tools, run.kind, resume),
        cwd=workspace,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "MAX_THINKING_TOKENS": "0"},
    )
    PROCESSES[run.id] = process
    timed_out = threading.Event()

    def expire() -> None:
        timed_out.set()
        kill(process)

    timer = threading.Timer(tools.agent_timeout_seconds, expire)
    timer.start()
    result: dict = {}
    try:
        process.stdin.write(run.prompt)
        process.stdin.close()
        for raw in process.stdout:
            line = raw.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except ValueError:
                _append(db, run, line)
                continue
            if event.get("session_id"):
                run.session_id = event["session_id"]
            if event.get("type") == "result":
                result = event
            text = describe(event, workspace)
            if text:
                _append(db, run, text)
        returncode = process.wait()
    finally:
        timer.cancel()
        PROCESSES.pop(run.id, None)
    return result, returncode, timed_out.is_set()


def _finish(
    run: AgentRun, result: dict, returncode: int, timed_out: bool
) -> None:
    run.summary = result.get("result")
    if timed_out:
        run.status = RunStatus.FAILED.value
        run.error_code = "timeout"
    elif result and not result.get("is_error") and returncode == 0:
        run.status = RunStatus.DONE.value
    else:
        run.status = RunStatus.FAILED.value
        run.error_code = "agent_failed"


def execute(bind: Engine, run_id: int, tools: EnvironmentTools) -> None:
    with Session(bind) as db:
        run = db.get(AgentRun, run_id)
        environment = current(db, run.project_id)
        previous = db.get(AgentRun, run.resumed_from) if run.resumed_from else None
        resume = previous.session_id if previous else None
        try:
            outcome = _stream(
                db, run, Path(environment.workspace), tools, resume
            )
        except FileNotFoundError:
            outcome = None
            run.status = RunStatus.FAILED.value
            run.error_code = "claude_unavailable"
        except Exception as error:
            outcome = None
            run.status = RunStatus.FAILED.value
            run.error_code = "unexpected_error"
            run.log += f"{type(error).__name__}: {error}\n"
        db.commit()
        db.refresh(run)
        if outcome and run.status == RunStatus.RUNNING.value:
            _finish(run, *outcome)
        if run.finished_at is None:
            run.finished_at = utcnow()
        db.commit()
