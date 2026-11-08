import logging
from typing import Dict, Any, List
from app.repositories.profile_repository import profile_repository
from app.repositories.memory_repository import memory_repository
from app.repositories.check_in_repository import check_in_repository
from app.repositories.conversation_repository import conversation_repository
from app.services.memory_service import memory_service
from app.orchestration.state import OrchestrationState

logger = logging.getLogger("solace.orchestration.context")


async def context_node(state: OrchestrationState) -> Dict[str, Any]:
    """
    Consent-aware context retrieval node.
    Hydrates authorized emotional memories, recent check-ins, and message history,
    then constructs the grounded system prompt according to active conversation mode.
    """
    user_id = state.get("user_id")
    session_id = state.get("session_id")
    user_message = state.get("user_message", "")
    mode = state.get("mode", "standard")
    user_email = state.get("user_email")
    user_message_id = state.get("user_message_id")

    # 1. Detect candidate memory for consent prompt
    memory_candidate = None
    detected = memory_service.detect_potential_memory(user_message)
    if detected:
        mem_text, mem_cat = detected
        memory_candidate = {
            "memory_text": mem_text,
            "category": mem_cat,
            "prompt": "Would you like me to remember this, so I can keep it in mind when we talk again?",
        }

    # 2. Retrieve authorized profile, active approved memories, and check-ins
    profile = await profile_repository.get_by_user_id(user_id, email=user_email)
    active_memories = await memory_repository.get_all(user_id, active_only=True)
    recent_check_ins, _ = await check_in_repository.get_history(user_id, limit=3)
    recent_messages = await conversation_repository.get_messages(user_id, session_id, limit=8)

    # 3. Match relevant memories
    matched_memories, context_summary = memory_service.retrieve_relevant_context(
        user_message=user_message,
        profile=profile,
        memories=active_memories,
        recent_check_ins=recent_check_ins,
    )

    # 4. Construct grounded system prompt
    system_prompt = memory_service.build_system_prompt(profile, context_summary, mode=mode)

    # 5. Build recent history payload (excluding current message)
    history_payload: List[Dict[str, str]] = []
    for m in recent_messages:
        if user_message_id and m.id == user_message_id:
            continue
        history_payload.append({"role": m.role, "content": m.content})

    return {
        "matched_memories": [m.model_dump() if hasattr(m, "model_dump") else dict(m) for m in matched_memories],
        "applied_memories_count": len(matched_memories),
        "context_summary": context_summary,
        "system_prompt": system_prompt,
        "memory_candidate": memory_candidate,
        "recent_history": history_payload,
    }
