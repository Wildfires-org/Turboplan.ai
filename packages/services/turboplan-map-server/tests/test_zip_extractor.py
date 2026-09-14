"""Unit tests for ZipExtractorService."""

import pytest
import struct
import zipfile
import zlib
from pathlib import Path
from unittest.mock import patch
import tempfile

from app.services.zip_extractor import ZipExtractorService
from app.core.exceptions import InvalidZipFileError


class TestZipExtractorService:
    """Test suite for ZipExtractorService."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = ZipExtractorService()
        self.temp_dir = tempfile.mkdtemp()
        self.temp_path = Path(self.temp_dir)
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def create_test_zip(self, files_to_add):
        """Helper to create a test ZIP file."""
        zip_path = self.temp_path / 'test.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for file_name, content in files_to_add.items():
                zf.writestr(file_name, content)
        return zip_path
    
    def test_extract_valid_zip(self):
        """Test extracting a valid ZIP file."""
        # Create test ZIP
        files = {
            'file1.txt': 'content1',
            'folder/file2.txt': 'content2'
        }
        zip_path = self.create_test_zip(files)
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()
        
        # Extract
        self.service.extract(zip_path, extract_path)
        
        # Verify extraction
        assert (extract_path / 'file1.txt').exists()
        assert (extract_path / 'folder' / 'file2.txt').exists()
        assert (extract_path / 'file1.txt').read_text() == 'content1'
    
    def test_extract_invalid_zip(self):
        """Test that invalid ZIP files raise InvalidZipFileError."""
        # Create invalid ZIP file
        invalid_zip = self.temp_path / 'invalid.zip'
        invalid_zip.write_text('This is not a ZIP file')
        
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()
        
        with pytest.raises(InvalidZipFileError) as exc_info:
            self.service.extract(invalid_zip, extract_path)
        
        assert "Invalid ZIP file" in str(exc_info.value)
    
    def test_zip_slip_entry_rejected(self):
        """An entry that resolves outside the extraction dir must be refused."""
        zip_path = self.temp_path / 'slip.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr('../evil.txt', 'x')
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with pytest.raises(InvalidZipFileError) as exc_info:
            self.service.extract(zip_path, extract_path)

        assert "escapes" in str(exc_info.value)
        assert not (self.temp_path / 'evil.txt').exists()

    def test_absolute_entry_rejected(self):
        """Absolute member names are treated as traversal too."""
        zip_path = self.temp_path / 'abs.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr('/etc/evil.txt', 'x')
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with pytest.raises(InvalidZipFileError):
            self.service.extract(zip_path, extract_path)

    def test_too_many_entries_rejected(self):
        zip_path = self.temp_path / 'many.zip'
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr('a.txt', 'x')

        with patch('app.services.zip_extractor.MAX_ENTRIES', 0):
            with pytest.raises(InvalidZipFileError) as exc_info:
                self.service.extract(zip_path, extract_path)

        assert "too many entries" in str(exc_info.value)

    def test_oversized_single_entry_rejected(self):
        """One member over MAX_SINGLE_FILE_SIZE is refused before extraction."""
        zip_path = self.create_test_zip({'big.txt': 'x' * 100})
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with patch('app.services.zip_extractor.MAX_SINGLE_FILE_SIZE', 10):
            with pytest.raises(InvalidZipFileError) as exc_info:
                self.service.extract(zip_path, extract_path)

        assert "exceeds the size limit" in str(exc_info.value)
        assert not (extract_path / 'big.txt').exists()

    def test_total_uncompressed_cap_rejected(self):
        """Members that individually fit but together blow the total budget."""
        zip_path = self.create_test_zip({
            'a.txt': 'x' * 8,
            'b.txt': 'y' * 8,
        })
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with patch('app.services.zip_extractor.MAX_SINGLE_FILE_SIZE', 1000), \
                patch('app.services.zip_extractor.MAX_TOTAL_UNCOMPRESSED', 10):
            with pytest.raises(InvalidZipFileError) as exc_info:
                self.service.extract(zip_path, extract_path)

        assert "uncompressed size exceeds the limit" in str(exc_info.value)
        assert not (extract_path / 'a.txt').exists()

    def test_declared_size_caps_bytes_written(self):
        """
        Pin the assumption the size caps rest on: the validator trusts the
        declared `file_size`, so a member whose header understates the data it
        actually carries must not be able to write more than it declared.
        CPython's ZipExtFile stops reading at `file_size`, so the extra bytes
        are dropped rather than expanded onto disk.
        """
        payload = b'A' * 100
        declared = 10
        zip_path = self._write_lying_size_zip('lie.txt', payload, declared)
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path) as zf:
            info = zf.infolist()[0]
            # The archive really does understate itself: 10 declared, 100 stored.
            assert info.file_size == declared
            assert info.compress_size == len(payload)

        self.service.extract(zip_path, extract_path)

        written = (extract_path / 'lie.txt').read_bytes()
        assert written == payload[:declared]
        assert len(written) == declared

    def test_lying_size_cannot_evade_the_cap(self):
        """
        The flip side: understating the size gets an entry past the validator,
        but truncation means it still cannot land more than the declared bytes
        on disk, so the cap holds in bytes even when the header lies.
        """
        payload = b'A' * 100
        declared = 4
        zip_path = self._write_lying_size_zip('lie.txt', payload, declared)
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with patch('app.services.zip_extractor.MAX_SINGLE_FILE_SIZE', 5), \
                patch('app.services.zip_extractor.MAX_TOTAL_UNCOMPRESSED', 5):
            self.service.extract(zip_path, extract_path)

        assert (extract_path / 'lie.txt').stat().st_size <= 5

    def test_nul_byte_member_name_is_sanitised_not_crashing(self):
        """
        A NUL in a member name would make Path.resolve() raise ValueError,
        which extract() does not translate — it would escape as a 500. CPython
        makes that unreachable by truncating filenames at the first NUL in
        ZipInfo.__init__, and the extractor keeps a backstop for it either way.
        This pins the behaviour so a change in either place is caught.
        """
        zip_path = self.temp_path / 'nul.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr('badXname.txt', 'x')
        # Patch the name in place: ZipInfo would strip the NUL on the way in.
        raw = zip_path.read_bytes().replace(b'badXname.txt', b'bad\x00name.txt')
        zip_path.write_bytes(raw)

        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path) as zf:
            assert zf.namelist() == ['bad']

        # No ValueError escapes; the entry lands under its truncated name.
        self.service.extract(zip_path, extract_path)
        assert (extract_path / 'bad').read_bytes() == b'x'

    def test_unresolvable_member_name_becomes_invalid_zip_error(self):
        """The backstop itself: a name realpath() rejects yields a 400, not 500."""
        zip_path = self.create_test_zip({'ok.txt': 'x'})
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        info = zipfile.ZipInfo('ok.txt')
        info.file_size = 1
        # Bypass ZipInfo.__init__'s NUL stripping the way only a non-CPython
        # reader could.
        info.filename = 'bad\x00name.txt'

        with patch.object(zipfile.ZipFile, 'infolist', return_value=[info]):
            with pytest.raises(InvalidZipFileError) as exc_info:
                self.service.extract(zip_path, extract_path)

        assert "invalid name" in str(exc_info.value)

    def _write_lying_size_zip(
        self, name: str, payload: bytes, declared_size: int
    ) -> Path:
        """
        Build a STORED archive whose headers understate the data they carry.

        zipfile always writes truthful sizes, so the local header and central
        directory are patched afterwards: uncompressed size is set to
        `declared_size` and the CRC to that of the truncated prefix, which is
        what a reader stopping at `file_size` will actually compute.
        """
        zip_path = self.temp_path / 'lying.zip'
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_STORED) as zf:
            zf.writestr(name, payload)

        raw = bytearray(zip_path.read_bytes())
        assert raw[:4] == b'PK\x03\x04'
        crc = zlib.crc32(payload[:declared_size]) & 0xFFFFFFFF

        # Local file header: crc at +14, uncompressed size at +22.
        struct.pack_into('<I', raw, 14, crc)
        struct.pack_into('<I', raw, 22, declared_size)

        # Central directory header: crc at +16, uncompressed size at +24.
        cd_offset = raw.find(b'PK\x01\x02')
        assert cd_offset != -1
        struct.pack_into('<I', raw, cd_offset + 16, crc)
        struct.pack_into('<I', raw, cd_offset + 24, declared_size)

        zip_path.write_bytes(bytes(raw))
        return zip_path

    def test_encrypted_zip_rejected(self):
        """zipfile signals password-protected members with RuntimeError."""
        zip_path = self.create_test_zip({'a.txt': 'x'})
        extract_path = self.temp_path / 'extracted'
        extract_path.mkdir()

        with patch.object(
            zipfile.ZipFile,
            'extractall',
            side_effect=RuntimeError("File 'a.txt' is encrypted, password required"),
        ):
            with pytest.raises(InvalidZipFileError) as exc_info:
                self.service.extract(zip_path, extract_path)

        assert "Encrypted" in str(exc_info.value)

    def test_find_gis_files_shapefiles(self):
        """Test finding shapefiles in directory."""
        # Create test directory structure
        test_dir = self.temp_path / 'gis_data'
        test_dir.mkdir()
        
        # Create shapefile components
        (test_dir / 'layer1.shp').touch()
        (test_dir / 'layer1.dbf').touch()
        (test_dir / 'layer1.shx').touch()
        
        # Create nested shapefile
        nested_dir = test_dir / 'nested'
        nested_dir.mkdir()
        (nested_dir / 'layer2.shp').touch()
        
        # Find GIS files
        result = self.service.find_gis_files(test_dir)
        
        assert len(result) == 2
        shp_files = [f for f in result if f['type'] == 'shapefile']
        assert len(shp_files) == 2
        
        names = [f['name'] for f in shp_files]
        assert 'layer1' in names
        assert 'layer2' in names
    
    def test_find_gis_files_geodatabase(self):
        """Test finding geodatabase directories."""
        # Create test directory structure
        test_dir = self.temp_path / 'gis_data'
        test_dir.mkdir()
        
        # Create geodatabase directories
        gdb1 = test_dir / 'data.gdb'
        gdb1.mkdir()
        (gdb1 / 'a00000001.gdbtable').touch()
        
        nested_dir = test_dir / 'nested'
        nested_dir.mkdir()
        gdb2 = nested_dir / 'project.gdb'
        gdb2.mkdir()
        
        # Find GIS files
        result = self.service.find_gis_files(test_dir)
        
        gdb_files = [f for f in result if f['type'] == 'gdb']
        assert len(gdb_files) == 2
        
        names = [f['name'] for f in gdb_files]
        assert 'data' in names
        assert 'project' in names
    
    def test_find_gis_files_mixed(self):
        """Test finding mixed GIS file types."""
        # Create test directory structure
        test_dir = self.temp_path / 'gis_data'
        test_dir.mkdir()
        
        # Create various file types
        (test_dir / 'layer.shp').touch()
        gdb = test_dir / 'database.gdb'
        gdb.mkdir()
        (test_dir / 'not_gis.txt').touch()
        (test_dir / 'document.pdf').touch()
        
        # Find GIS files
        result = self.service.find_gis_files(test_dir)
        
        assert len(result) == 2
        types = [f['type'] for f in result]
        assert 'shapefile' in types
        assert 'gdb' in types
    
    def test_find_gis_files_empty_directory(self):
        """Test finding GIS files in empty directory."""
        empty_dir = self.temp_path / 'empty'
        empty_dir.mkdir()
        
        result = self.service.find_gis_files(empty_dir)
        
        assert result == []
