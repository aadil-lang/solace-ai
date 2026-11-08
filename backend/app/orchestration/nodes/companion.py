import logging
from typing import Dict, Any
from langchain_core.callbacks import adispatch_custom_event
from app.core.exceptions import SolaceException
from app.services.ai_provider import get_ai_provider
from app.orchestration.state import OrchestrationState

logger = logging.getLogger("solace.orchestration.companion")


async def companion_node(state: OrchestrationState) -> Dict[str, Any]:
    """
    Companion LLM generation node.
    Streams tokens in real-time via adispatch_custom_event directly to the
    outer LangGraph event listener, preserving token-by-token streaming without full buffering.
    """
    user_message = state.get("user_message", "")
    system_prompt = state.get("system_prompt", "")
    history = state.get("recent_history", [])

    full_text = ""
    try:
        ai_provider = get_ai_provider()
        async for token in ai_provider.generate_response_stream(
            prompt=user_message,
            system_prompt=system_prompt,
            history=history,
        ):
            full_text += token
            # Stream token chunk in real-time through LangGraph event dispatch
            await adispatch_custom_event("token", {"token": token})

        return {
            "full_response_text": full_text,
            "has_streamed": True,
            "error": None,
        }

    except SolaceException as se:
        logger.warning(f"AI Provider SolaceException in companion node: {se.message}")
        await adispatch_custom_event("error", {"error": se.message, "code": se.code})
        return {
            "full_response_text": full_text,
            "error": se.message,
            "error_code": se.code,
            "has_streamed": len(full_text) > 0,
        }
    except Exception as e:
        logger.exception("Unexpected error in companion generation node")
        err_msg = "The AI companion is momentarily resting. Please try again in a moment."
        await adispatch_custom_event("error", {"error": err_msg, "code": "STREAM_FAILURE"})
        return {
            "full_response_text": full_text,
            "error": err_msg,
            "error_code": "STREAM_FAILURE",
            "has_streamed": len(full_text) > 0,
        }
