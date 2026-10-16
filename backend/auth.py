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
    """Verify Clerk JWT signature, expiration, and issuer."""
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token required."
        )

    issuer = os.getenv("CLERK_ISSUER")
    if not issuer:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured."
        )

    jwks_client = get_jwks_client()
    if jwks_client is None:
        raise HTTPException(
            status_code=503,
            detail="Authentication verification is unavailable."
        )

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer.rstrip("/"),
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True
            }
        )

        if not payload.get("sub"):
            raise HTTPException(
                status_code=401,
                detail="Token missing subject identifier."
            )

        return payload

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )
    except jwt.exceptions.PyJWKClientConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Authentication verification is temporarily unavailable."
        )
    except jwt.exceptions.PyJWKClientError:
        raise HTTPException(
            status_code=401,
            detail="Unable to verify authentication token."
        )
    except Exception as e:
        print(f"[AUTH ERROR] {type(e).__name__}")
        raise HTTPException(
            status_code=503,
            detail="Authentication verification is temporarily unavailable."
        )

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
    Allow guests when no token is supplied.
    Reject invalid tokens; return the verified Clerk user ID for valid tokens.
    """
    if not credentials or not credentials.credentials:
        return None

    claims = verify_clerk_token(credentials.credentials)
    user_id = claims.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication token contains no user identification."
        )

    return str(user_id)
