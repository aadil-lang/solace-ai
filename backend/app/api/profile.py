from fastapi import APIRouter, Depends, status
from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.repositories.profile_repository import profile_repository

router = APIRouter(prefix="/profile", tags=["User Profile"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description="Fetches the authenticated user's profile based strictly on verified JWT claims.",
)
async def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ProfileResponse:
    """Returns the authenticated user's profile. User ID is securely derived from JWT."""
    return await profile_repository.get_by_user_id(
        user_id=current_user.id,
        email=current_user.email
    )


@router.patch(
    "/me",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
    description="Updates the authenticated user's profile fields (e.g. preferred name, wellness goals, onboarding status).",
)
async def update_my_profile(
    updates: ProfileUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ProfileResponse:
    """Updates profile fields for the authenticated user derived from verified JWT."""
    return await profile_repository.update_by_user_id(
        user_id=current_user.id,
        updates=updates
    )

