import base64
import json
import urllib.error
import urllib.request

from app.errors import AppError

API_URL = "https://api.github.com"
TIMEOUT_SECONDS = 10


def _translate(status: int) -> AppError:
    if status == 401:
        return AppError(400, "github_token_invalid")
    if status == 403:
        return AppError(403, "github_forbidden")
    if status == 404:
        return AppError(404, "github_repo_not_found")
    if status == 422:
        return AppError(409, "github_repo_exists")
    return AppError(502, "github_error")


class GitHubClient:
    def __init__(self, token: str):
        self._token = token

    def _call(self, method: str, path: str, body: dict | None = None) -> dict:
        request = urllib.request.Request(
            API_URL + path,
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "moja-labs",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as r:
                return json.load(r)
        except urllib.error.HTTPError as error:
            raise _translate(error.code) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise AppError(502, "github_unreachable") from None

    def get_user(self) -> dict:
        return self._call("GET", "/user")

    def get_repo(self, full_name: str) -> dict:
        return self._call("GET", f"/repos/{full_name}")

    def create_repo(
        self, name: str, description: str | None, private: bool
    ) -> dict:
        return self._call(
            "POST",
            "/user/repos",
            {
                "name": name,
                "description": description or "",
                "private": private,
                "auto_init": False,
            },
        )

    def file_exists(self, full_name: str, path: str) -> bool:
        try:
            self._call("GET", f"/repos/{full_name}/contents/{path}")
        except AppError as error:
            if error.code == "github_repo_not_found":
                return False
            raise
        return True

    def put_file(
        self, full_name: str, path: str, content: str, message: str
    ) -> None:
        self._call(
            "PUT",
            f"/repos/{full_name}/contents/{path}",
            {
                "message": message,
                "content": base64.b64encode(content.encode()).decode(),
            },
        )


def github_client_factory() -> type[GitHubClient]:
    return GitHubClient
