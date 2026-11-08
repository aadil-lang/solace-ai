import logging
from typing import Any, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("solace.errors")


class SolaceException(Exception):
    """Base exception class for Solace AI backend."""
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "INTERNAL_ERROR",
        details: Optional[Any] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details


class ResourceNotFoundError(SolaceException):
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            code="RESOURCE_NOT_FOUND",
            details={"resource": resource, "id": identifier}
        )


class AuthenticationError(SolaceException):
    def __init__(self, message: str = "Invalid or expired authentication credentials."):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="AUTHENTICATION_FAILED"
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Register centralized error handlers for the FastAPI application."""

    @app.exception_handler(SolaceException)
    async def solace_exception_handler(request: Request, exc: SolaceException):
        logger.warning(
            f"Handled SolaceException: code={exc.code} status={exc.status_code} message={exc.message}"
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(f"HTTPException: status={exc.status_code} detail={exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                    "details": None,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.info(f"Validation error for path {request.url.path}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Input validation failed.",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception during request {request.method} {request.url.path}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred.",
                    "details": None,
                }
            },
        )

