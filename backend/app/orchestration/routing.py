from app.orchestration.state import OrchestrationState


def route_after_safety(state: OrchestrationState) -> str:
    """
    Evaluates whether deterministic safety was triggered.
    If crisis is detected, diverts immediately to the crisis terminal path,
    completely bypassing model generation and memory retrieval.
    """
    if state.get("is_crisis"):
        return "crisis_terminal"
    return "context"


def route_after_context(state: OrchestrationState) -> str:
    """
    Routes to the appropriate workflow based on mode.
    Currently defaults to 'companion' (standard, rant, post-rant).
    Extensible for future specialized workflows.
    """
    return "companion"
