from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.profile import router as profile_router
from app.api.check_ins import router as check_in_router
from app.api.conversations import router as conversation_router
from app.api.memories import router as memory_router
from app.api.chat import router as chat_router
from app.api.voice import router as voice_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(profile_router)
api_router.include_router(check_in_router)
api_router.include_router(conversation_router)
api_router.include_router(memory_router)
api_router.include_router(chat_router)
api_router.include_router(voice_router)

__all__ = [
    "api_router",
    "health_router",
    "profile_router",
    "check_in_router",
    "conversation_router",
    "memory_router",
    "chat_router",
    "voice_router",
]
