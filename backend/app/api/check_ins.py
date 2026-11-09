import logging
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.check_in import (
    CheckInCreate,
    CheckInResponse,
    CheckInHistoryResponse,
    CheckInMeaningfulUpdate,
    LandscapeSummaryResponse,
    LandscapeReflectionRequest,
    LandscapeReflectionResponse,
    LandscapeReflectionCreate,
    LandscapeReflectionRecord,
    LandscapeReflectionsListResponse,
)
from app.repositories.check_in_repository import check_in_repository
from app.services.landscape_service import landscape_service

logger = logging.getLogger("solace.check_in_api")

router = APIRouter(prefix="/check-ins", tags=["Mood Check-ins & Emotional Landscape"])


@router.post(
    "",
    response_model=CheckInResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a mood check-in",
    description="Records a user's emotional state, intensity, and optional reflection note.",
)
async def create_check_in(
    data: CheckInCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CheckInResponse:
    try:
        return await check_in_repository.create(user_id=current_user.id, data=data)
    except Exception as e:
        logger.error(f"Failed to record check-in for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud database temporarily unavailable. Entry preserved locally.",
        )


@router.get(
    "/history",
    response_model=CheckInHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve check-in history",
    description="Retrieves chronological mood check-in history, optionally filtered to meaningful bookmarks.",
)
async def get_check_in_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    meaningful_only: bool = Query(default=False, description="Filter to only bookmarked meaningful moments"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CheckInHistoryResponse:
    try:
        items, total = await check_in_repository.get_history(
            user_id=current_user.id,
            limit=limit,
            offset=offset,
            is_meaningful_only=meaningful_only,
        )
        return CheckInHistoryResponse(items=items, total=total)
    except Exception as e:
        logger.error(f"Failed to retrieve check-in history for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch check-in history at this time.",
        )


@router.get(
    "/landscape/summary",
    response_model=LandscapeSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get deterministic Emotional Landscape summary",
    description="Calculates timezone-aware, non-clinical distribution and summary metrics over a timeframe.",
)
async def get_landscape_summary(
    timeframe: Literal["7d", "30d", "all"] = Query(default="7d"),
    tz: str = Query(default="UTC", description="User's IANA timezone identifier (e.g., 'Asia/Kolkata')"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> LandscapeSummaryResponse:
    try:
        # Retrieve all check-ins for the user; service applies timezone-aware date filtering
        items, _ = await check_in_repository.get_history(
            user_id=current_user.id, limit=200, offset=0
        )
        return landscape_service.calculate_summary(
            check_ins=items, timeframe=timeframe, tz_name=tz
        )
    except Exception as e:
        logger.error(f"Failed to calculate landscape summary for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to calculate landscape summary at this time.",
        )


@router.patch(
    "/{check_in_id}/meaningful",
    response_model=CheckInResponse,
    status_code=status.HTTP_200_OK,
    summary="Toggle meaningful moment bookmark",
    description="Updates ONLY the is_meaningful flag. Any attempt to mutate mood, intensity, or notes is rejected.",
)
async def toggle_meaningful_bookmark(
    check_in_id: str,
    update: CheckInMeaningfulUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CheckInResponse:
    try:
        updated = await check_in_repository.toggle_meaningful(
            user_id=current_user.id,
            check_in_id=check_in_id,
            is_meaningful=update.is_meaningful,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Check-in with ID '{check_in_id}' not found.",
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update meaningful flag on check_in {check_in_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to update bookmark at this time.",
        )


# --- Landscape AI Reflection Endpoints ---

@router.post(
    "/landscape/reflect",
    response_model=LandscapeReflectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate contemplative landscape reflection",
    description="Generates an ephemeral 2-3 sentence reflection on selected moments. Does not automatically save.",
)
async def generate_landscape_reflection(
    request: LandscapeReflectionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> LandscapeReflectionResponse:
    # Use explicitly passed check-ins or fetch from user history
    check_ins = request.selected_check_ins
    if not check_ins:
        items, _ = await check_in_repository.get_history(user_id=current_user.id, limit=50)
        check_ins = items

    return await landscape_service.generate_reflection(
        request=request, check_ins=check_ins
    )


@router.post(
    "/landscape/reflections",
    response_model=LandscapeReflectionRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Explicitly save a landscape reflection",
    description="Saves a user-consented reflection to durable cloud storage.",
)
async def save_landscape_reflection(
    data: LandscapeReflectionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> LandscapeReflectionRecord:
    try:
        return await check_in_repository.save_reflection(user_id=current_user.id, data=data)
    except Exception as e:
        logger.error(f"Failed to save reflection for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to save reflection at this time.",
        )


@router.get(
    "/landscape/reflections",
    response_model=LandscapeReflectionsListResponse,
    status_code=status.HTTP_200_OK,
    summary="List saved landscape reflections",
)
async def list_saved_reflections(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> LandscapeReflectionsListResponse:
    try:
        items, total = await check_in_repository.get_reflections(
            user_id=current_user.id, limit=limit, offset=offset
        )
        return LandscapeReflectionsListResponse(items=items, total=total)
    except Exception as e:
        logger.error(f"Failed to list saved reflections for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve saved reflections.",
        )


@router.delete(
    "/landscape/reflections/{reflection_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a saved landscape reflection",
)
async def delete_saved_reflection(
    reflection_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        deleted = await check_in_repository.delete_reflection(
            user_id=current_user.id, reflection_id=reflection_id
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reflection '{reflection_id}' not found.",
            )
        return {"success": True, "id": reflection_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete reflection {reflection_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete reflection.",
        )


# --- Single Check-in CRUD ---

@router.get(
    "/{check_in_id}",
    response_model=CheckInResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single check-in",
)
async def get_check_in(
    check_in_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CheckInResponse:
    item = await check_in_repository.get_by_id(user_id=current_user.id, check_in_id=check_in_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Check-in with ID '{check_in_id}' not found.",
        )
    return item


@router.delete(
    "/{check_in_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete check-in",
)
async def delete_check_in(
    check_in_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        deleted = await check_in_repository.delete(user_id=current_user.id, check_in_id=check_in_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Check-in with ID '{check_in_id}' not found or already deleted.",
            )
        return {"success": True, "id": check_in_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete check_in {check_in_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete check-in.",
        )
