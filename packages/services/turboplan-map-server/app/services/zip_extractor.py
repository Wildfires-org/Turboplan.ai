"""ZIP file extraction service."""

import zipfile
from pathlib import Path
from typing import List, Dict

from app.core.exceptions import InvalidZipFileError


# Decompression-bomb guards. `extractall` on unvalidated input can expand a
# small archive into gigabytes on disk/memory.
MAX_ENTRIES = 10_000
MAX_SINGLE_FILE_SIZE = 200 * 1024 * 1024      # 200MB uncompressed per entry
MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024    # 500MB uncompressed total


class ZipExtractorService:
    """Service responsible for extracting and finding files in ZIP archives."""

    def extract(self, zip_path: Path, extract_path: Path) -> None:
        """
        Extract ZIP file to specified directory.

        Args:
            zip_path: Path to ZIP file
            extract_path: Path where to extract files

        Raises:
            Exception: If ZIP file is invalid, too large, or contains unsafe paths
        """
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                self._validate_members(zip_ref, extract_path)
                zip_ref.extractall(extract_path)
        except (zipfile.BadZipFile, zipfile.LargeZipFile) as e:
            raise InvalidZipFileError('Invalid ZIP file') from e
        except RuntimeError as e:
            # zipfile raises RuntimeError for password-protected entries.
            raise InvalidZipFileError('Encrypted ZIP files are not supported') from e
        except NotImplementedError as e:
            # Unsupported compression method (e.g. deflate64, ppmd).
            raise InvalidZipFileError('Unsupported ZIP compression method') from e

    def _validate_members(
        self, zip_ref: zipfile.ZipFile, extract_path: Path
    ) -> None:
        """Reject decompression bombs and path-traversal (zip-slip) entries."""
        infos = zip_ref.infolist()

        if len(infos) > MAX_ENTRIES:
            raise InvalidZipFileError('ZIP archive has too many entries')

        dest_root = extract_path.resolve()
        total_uncompressed = 0

        for info in infos:
            # Zip-slip: an entry name like "../../etc/passwd" would escape the
            # extraction directory. Resolve and confirm it stays inside.
            #
            # Backstop: a member name the OS refuses to interpret as a path
            # makes realpath() raise ValueError (embedded NUL) or OSError,
            # neither of which extract() handles — it would surface as a 500
            # rather than a 400. CPython currently makes that unreachable
            # because ZipInfo.__init__ truncates filenames at the first NUL,
            # but that sanitisation is invisible from here and is the only
            # thing standing between a crafted name and an unhandled crash.
            try:
                target = (dest_root / info.filename).resolve()
            except (ValueError, OSError) as e:
                raise InvalidZipFileError('ZIP entry has an invalid name') from e

            if target != dest_root and dest_root not in target.parents:
                raise InvalidZipFileError(
                    'ZIP entry escapes the extraction directory'
                )

            if info.file_size > MAX_SINGLE_FILE_SIZE:
                raise InvalidZipFileError('ZIP entry exceeds the size limit')

            # No per-entry ratio cap: deflate tops out at ~1032:1 and padded
            # fixed-width DBFs legitimately hit it. CPython's ZipExtFile stops
            # reading at the declared file_size, so the per-entry and total
            # caps above cannot be lied past.

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED:
                raise InvalidZipFileError(
                    'ZIP uncompressed size exceeds the limit'
                )

    def find_gis_files(self, directory: Path) -> List[Dict[str, str]]:
        """
        Find GIS files in directory.

        Args:
            directory: Directory to search in

        Returns:
            List of GIS file info dictionaries with path, type, and name
        """
        gis_files = []

        # Find .gdb directories
        for gdb_dir in directory.rglob('*.gdb'):
            if gdb_dir.is_dir():
                gis_files.append({
                    'path': str(gdb_dir),
                    'type': 'gdb',
                    'name': gdb_dir.stem
                })

        # Find .shp files
        for shp_file in directory.rglob('*.shp'):
            if shp_file.is_file():
                gis_files.append({
                    'path': str(shp_file),
                    'type': 'shapefile',
                    'name': shp_file.stem
                })

        return gis_files
