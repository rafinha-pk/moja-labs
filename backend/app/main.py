from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin.router import router as admin_router
from app.agent.router import router as agent_router
from app.agent.service import mark_interrupted as mark_runs_interrupted
from app.auth.router import router as auth_router
from app.changes.router import router as changes_router
from app.config import settings
from app.db import SessionLocal
from app.documents.router import router as documents_router
from app.environments.keepalive import start_keepalive, stop_keepalive
from app.environments.router import router as run_router
from app.environments.service import mark_interrupted
from app.errors import register_error_handlers
from app.github.router import router as github_router
from app.members.router import router as members_router
from app.projects.router import router as projects_router
from app.setup.router import router as setup_router
from app.skills.router import router as skills_router
from app.tasks.execution import router as execution_router
from app.tasks.plan import router as plan_router
from app.tasks.router import router as tasks_router
from app.usage.router import router as usage_router
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    with SessionLocal() as db:
        mark_interrupted(db)
        mark_runs_interrupted(db)
    keepalive = start_keepalive(settings.docker_command)
    yield
    stop_keepalive(keepalive)


app = FastAPI(title="Moja Labs API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(members_router)
app.include_router(setup_router)
app.include_router(run_router)
app.include_router(documents_router)
app.include_router(agent_router)
app.include_router(usage_router)
app.include_router(changes_router)
app.include_router(plan_router)
app.include_router(execution_router)
app.include_router(tasks_router)
app.include_router(skills_router)
app.include_router(github_router)
app.include_router(admin_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
