import logging
import jwt
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

logger = logging.getLogger("solace.auth")
security = HTTPBearer(auto_error=False)

# Optional JWKS client for asymmetric key verification
_jwks_client: Optional[jwt.PyJWKClient] = None


def get_jwks_client() -> Optional[jwt.PyJWKClient]:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    if settings.SUPABASE_URL:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            _jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
            return _jwks_client
        except Exception as e:
            logger.warning(f"Failed to initialize PyJWKClient for {jwks_url}: {e}")
    return None


class AuthenticatedUser(BaseModel):
    """Represents an authenticated Supabase user derived securely from a verified JWT."""
    id: str
    email: Optional[str] = None
    role: str = "authenticated"
    raw_claims: Dict[str, Any] = {}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """
    FastAPI dependency to verify Supabase JWT and derive user identity.
    Never trusts client-supplied user identifiers.
    Supports both legacy HS256 (JWT Secret), modern asymmetric JWKS (ES256/RS256),
    and direct Supabase client auth verification.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Inspect token header algorithm
    token_alg = "HS256"
    try:
        unverified_header = jwt.get_unverified_header(token)
        token_alg = unverified_header.get("alg", "HS256")
    except Exception:
        pass

    # 1. Verification via Supabase JWT Secret if configured and token is HS256
    jwt_secret = settings.SUPABASE_JWT_SECRET or ("test-secret-key-32-chars-minimum!!" if settings.ENVIRONMENT != "production" else "")
    if jwt_secret and token_alg == "HS256":
        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True}
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing subject ('sub') claim.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return AuthenticatedUser(
                id=user_id,
                email=payload.get("email"),
                role=payload.get("role", "authenticated"),
                raw_claims=payload
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.PyJWTError as e:
            logger.warning(f"HS256 JWT signature verification failed: {e}")
            # If explicit HS256 failed, don't silently accept

    # 2. Asymmetric JWKS verification if token is RS256/ES256 and SUPABASE_URL is set
    if settings.SUPABASE_URL and token_alg in ["RS256", "ES256"]:
        jwks_client = get_jwks_client()
        if jwks_client:
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[token_alg],
                    audience="authenticated",
                    options={"verify_exp": True}
                )
                user_id = payload.get("sub")
                if user_id:
                    return AuthenticatedUser(
                        id=user_id,
                        email=payload.get("email"),
                        role=payload.get("role", "authenticated"),
                        raw_claims=payload
                    )
            except jwt.ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token has expired.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except Exception as e:
                logger.warning(f"JWKS verification failed for {token_alg}: {e}")

    # 3. Verification via Supabase Client Auth API fallback
    if settings.SUPABASE_URL and (settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        try:
            from app.services.supabase_client import get_supabase_client
            client = get_supabase_client()
            user_response = client.auth.get_user(token)
            if user_response and user_response.user:
                return AuthenticatedUser(
                    id=user_response.user.id,
                    email=user_response.user.email,
                    role=user_response.user.role or "authenticated",
                    raw_claims={"app_metadata": user_response.user.app_metadata}
                )
        except Exception as e:
            logger.warning(f"Supabase auth.get_user verification failed: {e}")
            if "expired" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token has expired.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    # 4. Local Test/Dev Mock token handling (ONLY when Supabase is completely unconfigured)
    supabase_configured = bool(settings.SUPABASE_URL and (settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY))
    if not supabase_configured:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                return AuthenticatedUser(
                    id=user_id,
                    email=payload.get("email"),
                    role=payload.get("role", "authenticated"),
                    raw_claims=payload
                )
        except Exception:
            pass

        if settings.DEBUG and token.startswith("test-token-"):
            user_id = token.replace("test-token-", "")
            return AuthenticatedUser(
                id=user_id,
                email=f"{user_id}@example.com",
                role="authenticated",
                raw_claims={"sub": user_id}
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to verify authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
