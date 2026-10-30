from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.environments import runner
from app.environments.builder import SET_PACKAGE
from app.environments.docker import Docker, DockerError

OUTPUT_FOLDER = ".moja"
APK_NAME = "app.apk"
EXIT_FILE = "/tmp/moja-build.exit"
GRADLE_MEMORY = "-Dorg.gradle.jvmargs=-Xmx2g"
NO_MINIFY = "-Pandroid.enableMinifyInReleaseBuilds=false"
MIN_SDK_PATTERN = (
    "s/minSdkVersion rootProject.ext.minSdkVersion/minSdkVersion {}/"
)
KILL_LEFTOVERS = (
    "pkill -f '[g]radle'; pkill -f '[k]otlin-compiler'; "
    "pkill -f '[n]inja'; pkill -f '[c]make'; pkill -f '[c]lang'; true"
)


def stop_build(docker: Docker, container: str) -> None:
    runner.stop(docker, container, runner.BUILD)
    try:
        docker.run("exec", container, "sh", "-c", KILL_LEFTOVERS)
    except DockerError:
        pass


def build_script(package: str, min_sdk: int, abis: str) -> str:
    steps = " ".join(
        [
            "set -e;",
            "rm -rf /tmp/moja-build; mkdir -p /tmp/moja-build",
            f"/workspace/{OUTPUT_FOLDER};",
            "tar -C /workspace/frontend --exclude=./android"
            " --exclude=./.expo -cf - . |"
            " tar -C /tmp/moja-build -xf -;",
            "cd /tmp/moja-build;",
            "[ -d node_modules ] || npm install --no-audit --no-fund;",
            f"MOJA_ANDROID_PACKAGE={package} {SET_PACKAGE};",
            "npx expo prebuild --platform android --no-install;",
            f"sed -i '{MIN_SDK_PATTERN.format(min_sdk)}'"
            " android/app/build.gradle;",
            "cd android;",
            f"./gradlew assembleRelease --no-daemon {GRADLE_MEMORY}"
            f" {NO_MINIFY}"
            f" -PreactNativeArchitectures={abis};",
            "cp app/build/outputs/apk/release/app-release.apk"
            f" /workspace/{OUTPUT_FOLDER}/{APK_NAME};",
        ]
    )
    return f"rm -f {EXIT_FILE}; ( {steps} ); echo $? > {EXIT_FILE}"


@dataclass
class ApkState:
    state: str
    log: str
    size: int | None
    built_at: datetime | None


def apk_path(workspace: Path) -> Path:
    return workspace / OUTPUT_FOLDER / APK_NAME


def read_state(docker: Docker, container: str, workspace: Path) -> ApkState:
    file = apk_path(workspace)
    size = file.stat().st_size if file.is_file() else None
    built_at = (
        datetime.fromtimestamp(file.stat().st_mtime, UTC)
        if file.is_file()
        else None
    )
    log = runner.read_log(docker, container, runner.BUILD)
    if runner.is_running(docker, container, runner.BUILD):
        state = "running"
    else:
        code = (runner.read_file(docker, container, EXIT_FILE) or "").strip()
        if code and code != "0":
            state = "failed"
        elif size is not None:
            state = "done"
        else:
            state = "idle"
    return ApkState(state=state, log=log, size=size, built_at=built_at)
