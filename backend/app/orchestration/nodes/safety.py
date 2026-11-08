import logging
from typing import Dict, Any
from app.core.config import settings
from app.services.memory_service import memory_service, get_crisis_response
from app.orchestration.state import OrchestrationState

logger = logging.getLogger("solace.orchestration.safety")


async def safety_node(state: OrchestrationState) -> Dict[str, Any]:
    """
    Deterministic safety screening node.
    Authoritatively checks for crisis, self-harm, or emergency indicators
    prior to any model call or context expansion.
    """
    user_message = state.get("user_message", "")
    
    # Authoritative deterministic check
    if memory_service.is_crisis_input(user_message):
        logger.warning(f"Crisis safety condition triggered in orchestration graph for session '{state.get('session_id')}'.")
        crisis_text = get_crisis_response(getattr(settings, "CRISIS_REGION", "IN"))
        return {
            "is_crisis": True,
            "crisis_text": crisis_text,
            "full_response_text": crisis_text,
        }
    
    return {
        "is_crisis": False,
        "crisis_text": None,
    }
