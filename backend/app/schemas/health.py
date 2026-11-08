from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = Field(
        default="healthy",
        description="Operational status of the service",
        examples=["healthy"]
    )
    service: str = Field(
        default="solace-api",
        description="Identifier of the service",
        examples=["solace-api"]
    )
    version: str = Field(
        default="1.0.0",
        description="Semantic version of the service",
        examples=["1.0.0"]
    )

    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "service": "solace-api",
                "version": "1.0.0"
            }
        }

