from typing import Dict, List
from datetime import datetime
from pydantic import BaseModel, HttpUrl

class FileUploadRequest(BaseModel):
    url: HttpUrl

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
