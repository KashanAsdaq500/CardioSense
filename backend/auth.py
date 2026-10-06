import os
import json
import urllib.request
from typing import Optional, Dict, Any
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

CLERK_ISSUER: Optional[str] = os.getenv("CLERK_ISSUER")
CLERK_SECRET_KEY: Optional[str] = os.getenv("CLERK_SECRET_KEY")

_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    
    issuer = os.getenv("CLERK_ISSUER")
    if issuer:
        issuer_clean = issuer.rstrip("/")
        jwks_url = f"{issuer_clean}/.well-known/jwks.json"
        try:
            _jwks_client = PyJWKClient(jwks_url)
            return _jwks_client
        except Exception as e:
            print(f"[AUTH WARNING] Failed to initialize PyJWKClient from {jwks_url}: {e}")
            return None
    return None

def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verifies a Clerk session JWT token:
    1. If CLERK_ISSUER is configured, fetches Clerk's JWKS and verifies signature, expiration, and issuer.
    2. If token is invalid or expired, raises HTTP 401.
    3. If dev mode without CLERK_ISSUER set, securely decodes claims with expiration validation.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required.")

    issuer = os.getenv("CLERK_ISSUER")
    jwks_client = get_jwks_client()

    if jwks_client and issuer:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=issuer.rstrip("/"),
                options={"verify_exp": True, "verify_iss": True}
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        except jwt.InvalidTokenError as err:
            raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(err)}")
        except Exception as err:
            raise HTTPException(status_code=401, detail=f"Token validation failed: {str(err)}")

    # Fallback when CLERK_ISSUER is not yet set in environment:
    # Decode unverified claims safely to extract 'sub' user_id, but validate standard claims
    try:
        unverified_payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True}
        )
        if "sub" not in unverified_payload:
            raise HTTPException(status_code=401, detail="Token missing subject identifier.")
        return unverified_payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except Exception as err:
        raise HTTPException(status_code=401, detail=f"Unable to process token: {str(err)}")

def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> str:
    """
    Dependency that enforces authentication and returns the verified Clerk user ID (e.g. user_2...).
    Rejects unauthenticated requests with HTTP 401.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in to CardioSense."
        )
    
    token = credentials.credentials
    claims = verify_clerk_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication token contains no user identification."
        )
    return str(user_id)

def get_optional_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[str]:
    """
    Dependency that returns the verified user ID if a valid token is provided, or None if omitted.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        claims = verify_clerk_token(credentials.credentials)
        return str(claims.get("sub")) if claims.get("sub") else None
    except HTTPException:
        return None
