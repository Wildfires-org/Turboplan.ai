import os
import secrets
from fastapi import HTTPException, Security, Request
from fastapi.security import APIKeyHeader
from .schemas import ErrorResponse

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Security setup
MAP_SERVICE_API_KEY = os.getenv("MAP_SERVICE_API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(
    request: Request,
    api_key: str = Security(api_key_header)
) -> bool:
    """Verify API key for protected endpoints using constant-time comparison"""
    if request.method == "OPTIONS":
        return True

    if not api_key or not MAP_SERVICE_API_KEY or not secrets.compare_digest(api_key, MAP_SERVICE_API_KEY):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "API-Key"},
        )
    return True
