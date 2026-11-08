from fastapi import APIRouter, status
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns the operational status, service identifier, and version of the Solace AI backend.",
    response_description="Service is healthy and ready to accept traffic."
)
async def get_health() -> HealthResponse:
    """
    Health check endpoint for the Solace AI backend.
    Used by the mobile client, load balancers, and monitoring systems to verify connectivity.
    """
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.VERSION
    )

