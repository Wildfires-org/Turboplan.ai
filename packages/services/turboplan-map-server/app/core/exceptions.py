"""Custom exceptions for the GIS processing application."""


class GISProcessingError(Exception):
    """Base exception for GIS processing errors."""
    pass


class InvalidURLError(GISProcessingError):
    """Raised when URL validation fails."""
    pass


class FileSizeError(GISProcessingError):
    """Raised when file exceeds size limits."""
    pass


class DownloadError(GISProcessingError):
    """Raised when file download fails."""
    pass


class InvalidZipFileError(GISProcessingError):
    """Raised when ZIP file is invalid or corrupted."""
    pass


class NoGISFilesFoundError(GISProcessingError):
    """Raised when no GIS files are found in the ZIP archive."""
    pass


class GISFileProcessingError(GISProcessingError):
    """Raised when processing a GIS file fails."""
    pass


class LayerProcessingError(GISProcessingError):
    """Raised when processing a specific layer fails."""
    pass


class GeometryTransformError(GISProcessingError):
    """Raised when coordinate transformation fails."""
    pass
