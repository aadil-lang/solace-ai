import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings
from app.core.exceptions import SolaceException

logger = logging.getLogger("solace.supabase_client")

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Get or initialize Supabase client singleton for backend operations.
    Prefers SUPABASE_SERVICE_ROLE_KEY for database operations, falls back to SUPABASE_KEY.
    Raises SolaceException if credentials are not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not settings.SUPABASE_URL or not key:
        raise SolaceException(
            message="Supabase credentials (SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY) are not configured in environment.",
            status_code=503,
            code="DATABASE_UNCONFIGURED"
        )

    _supabase_client = create_client(settings.SUPABASE_URL, key)
    return _supabase_client
