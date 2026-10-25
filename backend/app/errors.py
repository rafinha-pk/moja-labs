from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, code: str):
        super().__init__(code)
        self.status_code = status_code
        self.code = code


def _error_body(code: str, **extra) -> dict:
    return {"error": {"code": code, **extra}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(
        request: Request, exc: AppError
    ) -> JSONResponse:
        return JSONResponse(_error_body(exc.code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = []
        for err in exc.errors():
            code = err["type"]
            if code == "value_error":
                code = err.get("msg", "").removeprefix("Value error, ") or code
            location = ".".join(
                str(part) for part in err["loc"] if part != "body"
            )
            fields.append({"field": location, "code": code})
        return JSONResponse(
            _error_body("validation_error", fields=fields), status_code=422
        )
