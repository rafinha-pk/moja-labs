from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

Token = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=10, max_length=255),
]
RepoName = Annotated[
    str, StringConstraints(pattern=r"^[A-Za-z0-9._-]{1,100}$")
]
FullName = Annotated[
    str,
    StringConstraints(
        pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", max_length=200
    ),
]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=350)
]


class TokenIn(BaseModel):
    token: Token


class AccountOut(BaseModel):
    connected: bool
    login: str | None = None


class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    html_url: str
    is_private: bool


class ProjectGithubOut(BaseModel):
    token_source: Literal["project", "account", "none"]
    login: str | None
    repository: RepositoryOut | None


class RepositoryCreate(BaseModel):
    name: RepoName
    description: Description | None = None
    private: bool = True


class RepositoryLink(BaseModel):
    full_name: FullName
