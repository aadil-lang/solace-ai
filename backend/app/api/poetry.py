import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth import AuthenticatedUser, get_current_user, get_optional_user
from app.schemas.poetry import (
    PoetryGenerateRequest,
    PoetryGenerateResponse,
    SavedPoemCreate,
    SavedPoemResponse,
    SavedPoemListResponse,
)
from app.services.poetry_service import poetry_service
from app.repositories.poetry_repository import poetry_repository

logger = logging.getLogger("solace.api.poetry")
router = APIRouter(prefix="/poetry", tags=["Words of Solace"])


@router.post(
    "/generate",
    response_model=PoetryGenerateResponse,
    summary="Generate personalized, contemplative poetry (Words of Solace)",
    description="Supports English, Urdu Nastaliq, Bilingual (Urdu + English), and Roman Urdu formats with deterministic safety overrides.",
)
async def generate_poem(
    data: PoetryGenerateRequest,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
    try:
        user_identifier = current_user.id if current_user else "guest"
        logger.info(f"Poetry generation requested by {user_identifier} (format={data.format.value}, theme={data.theme.value})")
        return await poetry_service.generate_poetry(data)
    except Exception as e:
        logger.exception("Error generating poetry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to compose poetry at this moment. Please try again shortly.",
        )


@router.post(
    "/save",
    response_model=SavedPoemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a generated poem to personal Words of Solace collection",
    description="Requires authenticated user. Guest users must save locally on the device.",
)
async def save_poem(
    data: SavedPoemCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        logger.info(f"Saving poem for user {current_user.id}: '{data.title}'")
        return await poetry_repository.save_poem(user_id=current_user.id, data=data)
    except Exception as e:
        logger.exception("Error saving poem")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save poem to your collection.",
        )


@router.get(
    "/saved",
    response_model=SavedPoemListResponse,
    summary="Retrieve user's saved poetry collection",
    description="Returns user-scoped saved poems, sorted by creation date descending.",
)
async def get_saved_poems(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        items, total = await poetry_repository.get_saved_poems(
            user_id=current_user.id, limit=limit, offset=offset
        )
        return SavedPoemListResponse(items=items, total=total)
    except Exception as e:
        logger.exception("Error retrieving saved poems")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve your saved poems.",
        )


@router.delete(
    "/saved/{poem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved poem from personal collection",
    description="Enforces user isolation; users can only delete their own saved poems.",
)
async def delete_saved_poem(
    poem_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        success = await poetry_repository.delete_saved_poem(
            user_id=current_user.id, poem_id=poem_id
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Poem not found or already deleted.",
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting poem")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete poem.",
        )

