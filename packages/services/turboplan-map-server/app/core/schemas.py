from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl

class FileUploadRequest(BaseModel):
    url: HttpUrl
    # Original file name. Only names layers and hints the format; the file
    # content decides what is processed.
    filename: Optional[str] = Field(default=None, max_length=1024)

class HealthResponse(BaseModel):
    status: str
    message: str
    supportedFormats: List[str]
    processor: str
    runtime: str
    timestamp: str
    endpoints: Dict[str, str]

class ErrorResponse(BaseModel):
    error: str
    success: bool
    code: str
