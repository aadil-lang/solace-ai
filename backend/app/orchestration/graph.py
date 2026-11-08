import json
import logging
from typing import AsyncIterator, Optional, Dict, Any
from langgraph.graph import StateGraph, START, END
from app.core.exceptions import SolaceException
from app.repositories.conversation_repository import conversation_repository
from app.schemas.conversation import ConversationMessageCreate
from app.orchestration.state import OrchestrationState
from app.orchestration.nodes.safety import safety_node
from app.orchestration.nodes.context import context_node
from app.orchestration.nodes.companion import companion_node
from app.orchestration.routing import route_after_safety, route_after_context

logger = logging.getLogger("solace.orchestration.graph")


async def crisis_terminal_node(state: OrchestrationState) -> Dict[str, Any]:
    """
    Terminal node for crisis responses to bypass model generation.
    """
    return {
        "is_crisis": True,
        "completed": True,
    }


def build_orchestration_graph() -> Any:
    """
    Compiles the minimal, typed LangGraph orchestration pipeline for Solace AI.
    """
    builder = StateGraph(OrchestrationState)

    # Register nodes
    builder.add_node("safety", safety_node)
    builder.add_node("context", context_node)
    builder.add_node("companion", companion_node)
    builder.add_node("crisis_terminal", crisis_terminal_node)

    # Register deterministic workflow transitions
    builder.add_edge(START, "safety")
    builder.add_conditional_edges(
        "safety",
        route_after_safety,
        {
            "crisis_terminal": "crisis_terminal",
            "context": "context",
        },
    )
    builder.add_conditional_edges(
        "context",
        route_after_context,
        {
            "companion": "companion",
        },
    )
    builder.add_edge("companion", END)
    builder.add_edge("crisis_terminal", END)

    return builder.compile()


# Singleton compiled graph
orchestration_graph = build_orchestration_graph()


async def stream_orchestrated_chat(
    user_id: str,
    session_id: str,
    user_message_id: str,
    content: str,
    mode: str = "standard",
    user_email: Optional[str] = None,
) -> AsyncIterator[str]:
    """
    Executes the LangGraph orchestration pipeline and yields Server-Sent Events (SSE)
    in the exact format expected by the Solace mobile client parser.
    
    Guarantees:
    1. Zero full-response buffering (tokens yield immediately via event dispatch).
    2. Deterministic crisis safety interception before model execution.
    3. Proper error dispatch without duplicate stream restarts.
    """
    # 1. Emit message_start immediately
    start_payload = {
        "event": "message_start",
        "session_id": session_id,
        "user_message_id": user_message_id,
    }
    yield f"data: {json.dumps(start_payload)}\n\n"

    initial_state: OrchestrationState = {
        "user_id": user_id,
        "session_id": session_id,
        "user_message": content,
        "user_message_id": user_message_id,
        "user_email": user_email,
        "mode": mode,
        "is_crisis": False,
        "has_streamed": False,
        "full_response_text": "",
        "applied_memories_count": 0,
        "matched_memories": [],
    }

    streamed_any_tokens = False
    full_text = ""
    applied_count = 0
    matched_memory_ids = []
    error_occurred = False

    try:
        async for event in orchestration_graph.astream_events(initial_state, version="v2"):
            event_type = event.get("event")
            event_name = event.get("name", "")

            # A. Check safety crisis interception from safety node output
            if event_type == "on_chain_end" and event_name == "safety":
                data_output = event.get("data", {}).get("output", {})
                if data_output.get("is_crisis"):
                    crisis_text = data_output.get("crisis_text", "")
                    words = crisis_text.split(" ")
                    for i, word in enumerate(words):
                        chunk = word + (" " if i < len(words) - 1 else "")
                        streamed_any_tokens = True
                        yield f"data: {json.dumps({'event': 'token', 'token': chunk})}\n\n"

                    # Persist crisis safety message
                    assistant_msg = await conversation_repository.create_message(
                        session_id=session_id,
                        user_id=user_id,
                        data=ConversationMessageCreate(
                            role="assistant",
                            content=crisis_text,
                            metadata={"crisis_safety_response": True, "orchestrator": "langgraph"},
                        ),
                    )
                    complete_payload = {
                        "event": "message_complete",
                        "assistant_message_id": assistant_msg.id,
                        "content": crisis_text,
                        "applied_memories_count": 0,
                    }
                    yield f"data: {json.dumps(complete_payload)}\n\n"
                    return

            # B. Check for candidate emotional memory from context node
            if event_type == "on_chain_end" and event_name == "context":
                data_output = event.get("data", {}).get("output", {})
                candidate = data_output.get("memory_candidate")
                if candidate:
                    yield f"data: {json.dumps({'event': 'memory_suggestion', **candidate})}\n\n"
                
                applied_count = data_output.get("applied_memories_count", 0)
                matched_memories = data_output.get("matched_memories", [])
                matched_memory_ids = [m.get("id") for m in matched_memories if isinstance(m, dict) and "id" in m]

            # C. Stream token chunks from companion node event dispatch
            if event_type == "on_custom_event" and event_name == "token":
                token = event.get("data", {}).get("token", "")
                if token:
                    streamed_any_tokens = True
                    full_text += token
                    yield f"data: {json.dumps({'event': 'token', 'token': token})}\n\n"

            # D. Handle explicit error event dispatched from companion node
            if event_type == "on_custom_event" and event_name == "error":
                error_occurred = True
                err_data = event.get("data", {})
                yield f"data: {json.dumps({'event': 'error', 'error': err_data.get('error'), 'code': err_data.get('code')})}\n\n"
                return

        # 3. If streaming completed successfully without errors
        if not error_occurred and full_text:
            metadata = {
                "memories_used": matched_memory_ids,
                "mode": mode,
                "orchestrator": "langgraph",
            }
            assistant_msg = await conversation_repository.create_message(
                session_id=session_id,
                user_id=user_id,
                data=ConversationMessageCreate(
                    role="assistant",
                    content=full_text,
                    metadata=metadata,
                ),
            )
            complete_payload = {
                "event": "message_complete",
                "assistant_message_id": assistant_msg.id,
                "content": full_text,
                "applied_memories_count": applied_count,
            }
            yield f"data: {json.dumps(complete_payload)}\n\n"

    except Exception as e:
        logger.exception("Unexpected error during LangGraph orchestrated stream")
        # If tokens have already streamed, NEVER duplicate tokens or restart the generator
        err_msg = "The AI companion encountered a momentary pause. Please try again."
        yield f"data: {json.dumps({'event': 'error', 'error': err_msg, 'code': 'ORCHESTRATION_STREAM_ERROR'})}\n\n"
