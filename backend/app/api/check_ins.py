from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.check_in import CheckInCreate, CheckInResponse, CheckInHistoryResponse
from app.repositories.check_in_repository import check_in_repository

router = APIRouter(prefix="/check-ins", tags=["Mood Check-ins"])


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
    return await check_in_repository.create(user_id=current_user.id, data=data)


@router.get(
    "/history",
    response_model=CheckInHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve check-in history",
    description="Retrieves the chronological mood check-in history for the authenticated user.",
)
async def get_check_in_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CheckInHistoryResponse:
    items, total = await check_in_repository.get_history(
        user_id=current_user.id, limit=limit, offset=offset
    )
    return CheckInHistoryResponse(items=items, total=total)


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
    deleted = await check_in_repository.delete(user_id=current_user.id, check_in_id=check_in_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Check-in with ID '{check_in_id}' not found or already deleted.",
        )
    return {"success": True, "id": check_in_id}

