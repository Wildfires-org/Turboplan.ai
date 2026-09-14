import logging

from fastapi import APIRouter, HTTPException, Depends

from app.core.schemas import FileUploadRequest
from app.core.auth import verify_api_key
from app.core.exceptions import (
    DownloadError,
    FileSizeError,
    GISProcessingError,
    InvalidURLError,
    InvalidZipFileError,
    NoGISFilesFoundError,
)
from app.services.gis_processor import GISProcessor

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload")
async def process_gis_file(
    request: FileUploadRequest,
    _: bool = Depends(verify_api_key),
):
    """Process GIS file from URL. API key authentication is enforced."""
    try:
        processor = GISProcessor()
        result = await processor.process_url(str(request.url))
        return result
    except (InvalidURLError, InvalidZipFileError, NoGISFilesFoundError) as e:
        # Caller-side problems (bad URL/host, broken archive, nothing usable
        # inside). Messages are deliberately coarse and never echo upstream
        # errors, so surfacing them is safe.
        logger.warning("GIS upload rejected: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except FileSizeError as e:
        logger.warning("GIS upload too large: %s", e)
        raise HTTPException(status_code=413, detail=str(e))
    except DownloadError as e:
        # The upstream the caller pointed us at was unreachable, refused the
        # connection or timed out. That is a failure of *their* origin, not of
        # this service, so 502 rather than 500. The message is already the
        # coarse, non-leaking text produced by FileDownloadService.
        logger.warning("GIS upload upstream fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except GISProcessingError as e:
        # Download failures and processing errors: our own coarse messages.
        logger.warning("GIS processing failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Processing error: {str(e)}"
        )
    except Exception:
        # Anything else may embed internal hosts, paths or library internals.
        logger.exception("Unexpected error processing GIS upload")
        raise HTTPException(
            status_code=500,
            detail="Processing error"
        )
