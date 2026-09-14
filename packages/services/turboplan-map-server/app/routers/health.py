from datetime import datetime
from fastapi import APIRouter

from app.core.schemas import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint - publicly accessible"""
    return HealthResponse(
        status="OK",
        message="GIS Fiona Server running",
        supportedFormats=[".shp", ".gdb"],
        processor="Fiona (Python 3.12)",
        runtime="Serverless Functions",
        timestamp=datetime.utcnow().isoformat() + "Z",
        endpoints={
            "health": "/api/health",
            "upload": "/api/upload"
        }
    )
