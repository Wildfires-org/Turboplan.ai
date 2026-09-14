import tempfile
from pathlib import Path
from typing import List, Dict, Any

from fastapi.concurrency import run_in_threadpool

from app.services.file_downloader import FileDownloadService
from app.services.zip_extractor import ZipExtractorService
from app.services.gis_file_processor import GISFileProcessorService
from app.core.exceptions import NoGISFilesFoundError


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
    
    async def process_url(self, url: str) -> List[Dict[str, Any]]:
        """
        Process GIS file from URL.

        Every step below is blocking: a synchronous HTTP download, zip
        extraction, and fiona/shapely parsing. The service runs a single
        uvicorn worker, so doing that work inline on the event loop would
        freeze every other request — health checks included — for the whole
        duration of one upload. Hand it to the threadpool instead and keep this
        coroutine as the public entry point.

        Args:
            url: URL pointing to a ZIP file containing GIS data

        Returns:
            List of processed GIS data results

        Raises:
            Exception: If download fails, ZIP is invalid, or no GIS files found
        """
        return await run_in_threadpool(self.process_url_sync, url)

    def process_url_sync(self, url: str) -> List[Dict[str, Any]]:
        """Blocking implementation of :meth:`process_url`."""
        # Download file
        file_data = self.file_downloader.download(url)

        # Process in temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Save downloaded file
            zip_path = temp_path / 'upload.zip'
            with open(zip_path, 'wb') as f:
                f.write(file_data)

            # Extract and process
            return self._process_zip_file(zip_path, temp_path)

    def _process_zip_file(self, zip_path: Path, temp_path: Path) -> List[Dict[str, Any]]:
        """Process ZIP file containing GIS data."""
        # Create extraction directory
        extract_path = temp_path / 'extracted'
        extract_path.mkdir()
        
        # Extract ZIP
        self.zip_extractor.extract(zip_path, extract_path)
        
        # Find GIS files
        gis_files = self.zip_extractor.find_gis_files(extract_path)
        
        if not gis_files:
            raise NoGISFilesFoundError('No GIS files found (.shp or .gdb)')
        
        # Process all GIS files
        results = []
        for gis_file in gis_files:
            file_results = self.gis_processor.process_file(gis_file)
            results.extend(file_results)
        
        return results
