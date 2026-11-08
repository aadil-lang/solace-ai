from typing import TypedDict, Optional, List, Dict, Any


class OrchestrationState(TypedDict, total=False):
    """
    Typed graph state for Solace AI orchestration workflows.
    Ensures clear boundaries, type safety, and zero leakage of sensitive data.
    """
    # Core identifiers & request inputs
    user_id: str
    session_id: str
    user_message: str
    user_message_id: Optional[str]
    user_email: Optional[str]
    mode: str  # "standard", "rant", "post_rant"
    post_rant_action: Optional[str]  # "just_listen", "reflect", "advice"

    # Deterministic Safety
    is_crisis: bool
    crisis_text: Optional[str]

    # Context & Consent-Filtered Memory
    matched_memories: List[Dict[str, Any]]
    context_summary: str
    system_prompt: str
    memory_candidate: Optional[Dict[str, Any]]
    recent_history: List[Dict[str, str]]

    # Response & Streaming State
    full_response_text: str
    assistant_message_id: Optional[str]
    applied_memories_count: int

    # Lifecycle & Telemetry Metadata (Never logs private message contents)
    has_streamed: bool
    fallback_required: bool
    error: Optional[str]
    error_code: Optional[str]

