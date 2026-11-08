import json
import logging
from typing import AsyncIterator
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import StreamingResponse
from app.core.auth import AuthenticatedUser, get_current_user
from app.core.exceptions import SolaceException
from app.schemas.conversation import ChatStreamRequest, ConversationMessageCreate
from app.repositories.conversation_repository import conversation_repository
from app.repositories.check_in_repository import check_in_repository
from app.repositories.memory_repository import memory_repository
from app.repositories.profile_repository import profile_repository
from app.services.memory_service import memory_service, get_crisis_response, CRISIS_RESPONSE
from app.services.ai_provider import get_ai_provider

logger = logging.getLogger("solace.chat")
router = APIRouter(prefix="/chat", tags=["AI Chat Stream"])


@router.post(
    "/stream",
    summary="Stream conversational reflection from Solace AI",
    description="Streams tokens via Server-Sent Events (SSE) while retrieving authorized emotional memories and check-ins.",
)
async def stream_chat(
    data: ChatStreamRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    user_id = current_user.id
    session_id = data.session_id

    # 1. Verify or create session
    if session_id:
        session = await conversation_repository.get_session_by_id(user_id=user_id, session_id=session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation session '{session_id}' not found.",
            )
    else:
        # Create a new session automatically
        initial_title = data.content[:40] + ("..." if len(data.content) > 40 else "")
        session = await conversation_repository.create_session(user_id=user_id, title=initial_title)
        session_id = session.id

    # 2. Persist the user message immediately
    user_msg = await conversation_repository.create_message(
        session_id=session_id,
        user_id=user_id,
        data=ConversationMessageCreate(role="user", content=data.content),
    )

    # 3. Generator for SSE stream
    async def sse_event_generator() -> AsyncIterator[str]:
        # Emit message_start
        start_payload = {
            "event": "message_start",
            "session_id": session_id,
            "user_message_id": user_msg.id,
        }
        yield f"data: {json.dumps(start_payload)}\n\n"

        # Crisis detection
        if memory_service.is_crisis_input(data.content):
            crisis_text = get_crisis_response()
            words = crisis_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                token_payload = {"event": "token", "token": chunk}
                yield f"data: {json.dumps(token_payload)}\n\n"

            # Persist crisis response
            assistant_msg = await conversation_repository.create_message(
                session_id=session_id,
                user_id=user_id,
                data=ConversationMessageCreate(
                    role="assistant",
                    content=crisis_text,
                    metadata={"crisis_safety_response": True},
                ),
            )
            complete_payload = {
                "event": "message_complete",
                "assistant_message_id": assistant_msg.id,
                "content": crisis_text,
            }
            yield f"data: {json.dumps(complete_payload)}\n\n"
            return

        # Check for potential consent-based emotional memory
        memory_cand = memory_service.detect_potential_memory(data.content)
        if memory_cand:
            mem_text, mem_cat = memory_cand
            suggestion_payload = {
                "event": "memory_suggestion",
                "memory_text": mem_text,
                "category": mem_cat,
                "prompt": "Would you like me to remember this, so I can keep it in mind when we talk again?",
            }
            yield f"data: {json.dumps(suggestion_payload)}\n\n"

        # Retrieve authorized context
        profile = await profile_repository.get_by_user_id(user_id, email=current_user.email)
        memories = await memory_repository.get_all(user_id, active_only=True)
        recent_check_ins, _ = await check_in_repository.get_history(user_id, limit=3)
        recent_messages = await conversation_repository.get_messages(user_id, session_id, limit=8)

        matched_memories, context_summary = memory_service.retrieve_relevant_context(
            user_message=data.content,
            profile=profile,
            memories=memories,
            recent_check_ins=recent_check_ins,
        )

        system_prompt = memory_service.build_system_prompt(profile, context_summary)

        # Build message history for provider
        history_payload = []
        for m in recent_messages:
            if m.id != user_msg.id:
                history_payload.append({"role": m.role, "content": m.content})

        full_assistant_text = ""
        try:
            ai_provider = get_ai_provider()
            async for token in ai_provider.generate_response_stream(
                prompt=data.content,
                system_prompt=system_prompt,
                history=history_payload,
            ):
                full_assistant_text += token
                yield f"data: {json.dumps({'event': 'token', 'token': token})}\n\n"

            # Persist completed assistant message
            metadata = {
                "memories_used": [m.id for m in matched_memories],
            }
            assistant_msg = await conversation_repository.create_message(
                session_id=session_id,
                user_id=user_id,
                data=ConversationMessageCreate(
                    role="assistant", content=full_assistant_text, metadata=metadata
                ),
            )
            complete_payload = {
                "event": "message_complete",
                "assistant_message_id": assistant_msg.id,
                "content": full_assistant_text,
                "applied_memories_count": len(matched_memories),
            }
            yield f"data: {json.dumps(complete_payload)}\n\n"

        except SolaceException as se:
            logger.warning(f"AI Provider error during stream: {se.message}")
            err_payload = {
                "event": "error",
                "error": se.message,
                "code": se.code,
            }
            yield f"data: {json.dumps(err_payload)}\n\n"
        except Exception as e:
            logger.exception("Unexpected error during chat stream")
            err_payload = {
                "event": "error",
                "error": "The AI companion is momentarily resting. Please try again in a moment.",
                "code": "STREAM_FAILURE",
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

