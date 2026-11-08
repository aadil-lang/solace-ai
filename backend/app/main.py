import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import api_router, health_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for Solace AI — A premium AI-powered wellness companion.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS for mobile and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register centralized exception handlers
register_exception_handlers(app)

# Include root health check and full API v1 routers
app.include_router(health_router)
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )

