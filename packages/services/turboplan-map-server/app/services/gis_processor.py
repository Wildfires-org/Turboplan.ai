import tempfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import List, Dict, Any, Optional

from fastapi.concurrency import run_in_threadpool

from app.services.file_downloader import FileDownloadService
from app.services.zip_extractor import ZipExtractorService
from app.services.gis_file_processor import GISFileProcessorService
from app.core.exceptions import NoGISFilesFoundError, UnsupportedFileTypeError


SUPPORTED_FORMATS_MESSAGE = (
    'Supported formats: Shapefile (.shp with its .shx, .dbf and .prj), '
    'File Geodatabase (.gdb folder), GeoPackage (.gpkg), '
    'GeoJSON (.geojson or .json) and KML (.kml).'
)

SUPPORTED_UPLOADS_MESSAGE = (
    'Upload a ZIP with GIS data (Shapefile, File Geodatabase, GeoPackage, '
    'GeoJSON or KML), or a single .geojson, .kml, .kmz or .gpkg file.'
)

# Magic bytes / markers used to recognise an upload by its content. The file
# name is only a hint: storage keys and presigned URLs often lose it.
ZIP_SIGNATURES = (b'PK\x03\x04', b'PK\x05\x06')
SQLITE_SIGNATURE = b'SQLite format 3\x00'
TEXT_SNIFF_BYTES = 64 * 1024

MAX_FILENAME_LENGTH = 255

# Standalone (non-archive) formats: detected type → (temp file suffix, type
# name used in results, matching the names ZipExtractorService assigns).
STANDALONE_FORMATS = {
    'geopackage': '.gpkg',
    'geojson': '.geojson',
    'kml': '.kml',
}


def sanitize_filename(filename: Optional[str]) -> Optional[str]:
    """
    Reduce a caller-supplied name to a bare file name, for display only.

    It is never used to build a filesystem path; it only names results and
    decides between formats whose content looks alike.
    """
    if not filename:
        return None
    # Strip any directory part, whichever separator the client used.
    name = PureWindowsPath(PurePosixPath(filename).name).name.strip()
    name = ''.join(ch for ch in name if ch.isprintable())
    return name[:MAX_FILENAME_LENGTH] or None


def detect_upload_format(data: bytes, filename: Optional[str] = None) -> str:
    """
    Identify what was uploaded: 'zip' (also KMZ), 'geopackage', 'geojson' or
    'kml'. Content decides; the extension only breaks ties for JSON-like text.

    Raises:
        UnsupportedFileTypeError: When the content is none of the above.
    """
    if data.startswith(ZIP_SIGNATURES):
        return 'zip'

    if data.startswith(SQLITE_SIGNATURE):
        return 'geopackage'

    head = data[:TEXT_SNIFF_BYTES].lstrip(b'\xef\xbb\xbf \t\r\n')
    lowered = head.lower()

    if b'<kml' in lowered:
        return 'kml'

    if head.startswith(b'{'):
        compact = b''.join(head.split())
        if (b'"type":"FeatureCollection"' in compact
                or b'"type":"Feature"' in compact):
            return 'geojson'
        extension = Path(filename or '').suffix.lower()
        if extension in ('.geojson', '.json'):
            # A FeatureCollection whose first 64KB happen to be one huge
            # geometry: trust the extension and let Fiona decide.
            return 'geojson'

    extension = Path(filename or '').suffix.lower()
    # Echo the extension only when it is short and plain: it is user input.
    is_plain = 1 < len(extension) <= 10 and extension[1:].isalnum()
    label = f' ({extension})' if is_plain else ''
    raise UnsupportedFileTypeError(
        f'Unsupported file type{label}. {SUPPORTED_UPLOADS_MESSAGE}'
    )


class GISProcessor:
    """Orchestrator for processing GIS files from URLs.

    This class coordinates the workflow of downloading, extracting, and processing
    GIS files by delegating to specialized services.
    """

    def __init__(self, max_file_size: int = 100 * 1024 * 1024):
        """
        Initialize the GIS processor with its service dependencies.

        Args:
            max_file_size: Maximum file size in bytes (default 100MB)
        """
        self.file_downloader = FileDownloadService(max_file_size)
        self.zip_extractor = ZipExtractorService()
        self.gis_processor = GISFileProcessorService()

    async def process_url(
        self, url: str, filename: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Process GIS file from URL.

        Every step below is blocking: a synchronous HTTP download, zip
        extraction, and fiona/shapely parsing. The service runs a single
        uvicorn worker, so doing that work inline on the event loop would
        freeze every other request — health checks included — for the whole
        duration of one upload. Hand it to the threadpool instead and keep this
        coroutine as the public entry point.

        Args:
            url: URL of a ZIP/KMZ archive or a standalone GeoJSON, KML or
                GeoPackage file
            filename: Original file name, used to name layers and as a
                format hint (optional)

        Returns:
            List of processed GIS data results

        Raises:
            Exception: If download fails, the file is not a supported GIS
                format, or no GIS files are found
        """
        return await run_in_threadpool(self.process_url_sync, url, filename)

    def process_url_sync(
        self, url: str, filename: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Blocking implementation of :meth:`process_url`."""
        file_data = self.file_downloader.download(url)
        return self.process_bytes(file_data, filename)

    def process_bytes(
        self, file_data: bytes, filename: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Detect the format of downloaded bytes and process them."""
        display_name = sanitize_filename(filename)
        upload_format = detect_upload_format(file_data, display_name)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            if upload_format == 'zip':
                zip_path = temp_path / 'upload.zip'
                zip_path.write_bytes(file_data)
                return self._process_zip_file(zip_path, temp_path, display_name)

            # Fixed on-disk name: the caller's name never touches the path.
            file_path = temp_path / f'upload{STANDALONE_FORMATS[upload_format]}'
            file_path.write_bytes(file_data)
            return self.gis_processor.process_file({
                'path': str(file_path),
                'type': upload_format,
                'name': Path(display_name).stem if display_name else 'upload',
                'display_name': display_name or file_path.name,
            })

    def _process_zip_file(
        self, zip_path: Path, temp_path: Path, display_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Process ZIP (or KMZ) file containing GIS data."""
        # Create extraction directory
        extract_path = temp_path / 'extracted'
        extract_path.mkdir()

        # Extract ZIP
        self.zip_extractor.extract(zip_path, extract_path)

        # Find GIS files
        gis_files = self.zip_extractor.find_gis_files(extract_path)

        if not gis_files:
            raise NoGISFilesFoundError(
                f'No GIS data found in the ZIP. {SUPPORTED_FORMATS_MESSAGE}'
            )

        # A KMZ always stores its main document as "doc.kml"; name the layer
        # after the KMZ the user uploaded instead.
        if display_name and Path(display_name).suffix.lower() == '.kmz':
            for gis_file in gis_files:
                if gis_file['type'] == 'kml' and gis_file['name'] == 'doc':
                    gis_file['name'] = Path(display_name).stem

        # Process all GIS files
        results = []
        for gis_file in gis_files:
            file_results = self.gis_processor.process_file(gis_file)
            results.extend(file_results)

        return results
