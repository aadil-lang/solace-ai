from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.memory import (
    MemoryCreate,
    MemoryUpdate,
    MemoryResponse,
    MemoryListResponse,
)
from app.repositories.memory_repository import memory_repository

router = APIRouter(prefix="/memories", tags=["Emotional Memories"])


@router.get(
    "",
    response_model=MemoryListResponse,
    status_code=status.HTTP_200_OK,
    summary="List stored emotional memories",
    description="Retrieves the authenticated user's consent-approved emotional memories.",
)
async def list_memories(
    active_only: bool = Query(default=False, description="Filter for active memories only"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> MemoryListResponse:
    items = await memory_repository.get_all(user_id=current_user.id, active_only=active_only)
    return MemoryListResponse(items=items, total=len(items))


@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new emotional memory",
    description="Creates a user-approved emotional memory.",
)
async def create_memory(
    data: MemoryCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> MemoryResponse:
    return await memory_repository.create(user_id=current_user.id, data=data)


@router.patch(
    "/{memory_id}",
    response_model=MemoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit or toggle an emotional memory",
    description="Allows updating memory text, category, or disabling/enabling memory usage.",
)
async def update_memory(
    memory_id: str,
    updates: MemoryUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> MemoryResponse:
    item = await memory_repository.update(
        user_id=current_user.id, memory_id=memory_id, updates=updates
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory with ID '{memory_id}' not found.",
        )
    return item


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an emotional memory",
)
async def delete_memory(
    memory_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    deleted = await memory_repository.delete(user_id=current_user.id, memory_id=memory_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory with ID '{memory_id}' not found or already deleted.",
        )
    return {"success": True, "id": memory_id}

