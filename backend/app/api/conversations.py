from typing import List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.conversation import (
    ConversationSessionCreate,
    ConversationSessionResponse,
    ConversationMessageResponse,
)
from app.repositories.conversation_repository import conversation_repository

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.post(
    "",
    response_model=ConversationSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation session",
)
async def create_conversation_session(
    data: ConversationSessionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ConversationSessionResponse:
    return await conversation_repository.create_session(
        user_id=current_user.id, title=data.title
    )


@router.get(
    "",
    response_model=List[ConversationSessionResponse],
    status_code=status.HTTP_200_OK,
    summary="List conversation sessions",
)
async def list_conversation_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[ConversationSessionResponse]:
    return await conversation_repository.get_sessions(user_id=current_user.id)


@router.get(
    "/{session_id}",
    response_model=ConversationSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get conversation session details",
)
async def get_conversation_session(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ConversationSessionResponse:
    session = await conversation_repository.get_session_by_id(
        user_id=current_user.id, session_id=session_id
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation session '{session_id}' not found.",
        )
    return session


@router.get(
    "/{session_id}/messages",
    response_model=List[ConversationMessageResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve chronological messages for session",
)
async def get_session_messages(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[ConversationMessageResponse]:
    # Verify session ownership first
    session = await conversation_repository.get_session_by_id(
        user_id=current_user.id, session_id=session_id
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation session '{session_id}' not found.",
        )
    return await conversation_repository.get_messages(
        user_id=current_user.id, session_id=session_id, limit=limit
    )


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete conversation session",
)
async def delete_conversation_session(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    deleted = await conversation_repository.delete_session(
        user_id=current_user.id, session_id=session_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation session '{session_id}' not found or already deleted.",
        )
    return {"success": True, "id": session_id}

