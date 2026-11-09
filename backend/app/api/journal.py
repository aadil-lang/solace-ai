import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth import AuthenticatedUser, get_current_user, get_optional_user
from app.schemas.journal import (
    JournalCreateRequest,
    JournalUpdateRequest,
    JournalResponse,
    JournalListResponse,
    JournalReflectionRequest,
    JournalReflectionResponse,
)
from app.services.journal_service import journal_service
from app.repositories.journal_repository import journal_repository

logger = logging.getLogger("solace.api.journal")
router = APIRouter(prefix="/journal", tags=["Voice Journal"])


@router.post(
    "/reflect",
    response_model=JournalReflectionResponse,
    summary="Generate a private, gentle reflection on a voice journal transcript",
    description="Only called upon explicit user request. Features deterministic crisis screening. Never persists audio or alters conversational memory.",
)
async def reflect_on_journal(
    data: JournalReflectionRequest,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
    try:
        user_identifier = current_user.id if current_user else "guest"
        logger.info(f"Journal reflection requested by {user_identifier}")
        return await journal_service.generate_reflection(data)
    except Exception as e:
        logger.exception("Error generating journal reflection")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate reflection at this moment. Please try again shortly.",
        )


@router.post(
    "/save",
    response_model=JournalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a finalized voice journal entry",
    description="Requires authenticated user. Transcript must have been reviewed by the user. Guest users store locally.",
)
async def save_journal_entry(
    data: JournalCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        logger.info(f"Saving voice journal entry for user {current_user.id} (length={len(data.transcript)} chars)")
        return await journal_repository.save_journal(user_id=current_user.id, data=data)
    except Exception as e:
        logger.exception("Error saving voice journal entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save journal entry to your collection.",
        )


@router.get(
    "/entries",
    response_model=JournalListResponse,
    summary="Retrieve user's voice journal collection",
    description="Returns user-scoped journal entries, sorted by creation date descending.",
)
async def get_journal_entries(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        items, total = await journal_repository.get_journals(
            user_id=current_user.id, limit=limit, offset=offset
        )
        return JournalListResponse(items=items, total=total)
    except Exception as e:
        logger.exception("Error retrieving journal entries")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve your journal entries.",
        )


@router.get(
    "/entries/{journal_id}",
    response_model=JournalResponse,
    summary="Retrieve a single journal entry",
    description="Enforces user isolation; users can only retrieve their own journal entries.",
)
async def get_journal_entry(
    journal_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        entry = await journal_repository.get_journal_by_id(
            user_id=current_user.id, journal_id=journal_id
        )
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found.",
            )
        return entry
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error retrieving journal entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve journal entry.",
        )


@router.patch(
    "/entries/{journal_id}",
    response_model=JournalResponse,
    summary="Update a journal entry's title, transcript, or reflection",
    description="Enforces user isolation; users can only update their own journal entries.",
)
async def update_journal_entry(
    journal_id: str,
    data: JournalUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        entry = await journal_repository.update_journal(
            user_id=current_user.id, journal_id=journal_id, data=data
        )
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found or unauthorized.",
            )
        return entry
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating journal entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update journal entry.",
        )


@router.delete(
    "/entries/{journal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a journal entry from personal collection",
    description="Enforces user isolation; users can only delete their own journal entries.",
)
async def delete_journal_entry(
    journal_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        success = await journal_repository.delete_journal(
            user_id=current_user.id, journal_id=journal_id
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found or already deleted.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting journal entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete journal entry.",
        )
