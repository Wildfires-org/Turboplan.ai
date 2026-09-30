"""Standalone (non-ZIP) uploads: GeoJSON, KML, KMZ and GeoPackage.

Fixtures are generated in-test and fed through `GISProcessor.process_bytes`,
the step right after the download, so detection, reprojection and error
messages are exercised exactly as for a real upload.
"""

import io
import json
import shutil
import socket
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch

import fiona
import pytest

from app.core.exceptions import (
    NoGISFilesFoundError,
    UnsupportedFileTypeError,
)
from app.services import gis_file_processor
from app.services.gis_processor import (
    GISProcessor,
    detect_upload_format,
    sanitize_filename,
)

FEATURE_COLLECTION = {
    'type': 'FeatureCollection',
    'features': [{
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [-120.5, 38.25]},
        'properties': {'name': 'site'},
    }],
}

KML_DOCUMENT = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>site</name><Point><coordinates>-120.5,38.25</coordinates></Point></Placemark>
</Document></kml>"""

POINT_SCHEMA = {'geometry': 'Point', 'properties': {'name': 'str'}}
# Roughly (-120.5, 38.25) in Web Mercator metres.
MERCATOR_POINT = {'type': 'Point', 'coordinates': (-13414011.0, 4612285.0)}

requires_kml = pytest.mark.skipif(
    not gis_file_processor.KML_DRIVER,
    reason='GDAL build without a KML driver',
)


def geojson_bytes(indent=None) -> bytes:
    return json.dumps(FEATURE_COLLECTION, indent=indent).encode()


def kmz_bytes(entries) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buffer.getvalue()


class TestStandaloneUploads:
    def setup_method(self):
        self.temp_path = Path(tempfile.mkdtemp())
        self.processor = GISProcessor()

    def teardown_method(self):
        shutil.rmtree(self.temp_path, ignore_errors=True)

    def geopackage_bytes(self) -> bytes:
        path = self.temp_path / 'fixture.gpkg'
        with fiona.open(path, 'w', driver='GPKG', layer='sites',
                        schema=POINT_SCHEMA, crs='EPSG:3857') as dst:
            dst.write({'geometry': MERCATOR_POINT, 'properties': {'name': 'a'}})
        with fiona.open(path, 'w', driver='GPKG', layer='more_sites',
                        schema=POINT_SCHEMA, crs='EPSG:4326') as dst:
            dst.write({'geometry': {'type': 'Point', 'coordinates': (-120.0, 38.0)},
                       'properties': {'name': 'b'}})
        return path.read_bytes()

    def test_geojson(self):
        results = self.processor.process_bytes(geojson_bytes(2), 'Sites.geojson')

        assert len(results) == 1
        assert results[0]['success'] is True
        assert results[0]['type'] == 'geojson'
        assert results[0]['name'] == 'Sites'
        assert len(results[0]['data']['features']) == 1

    @requires_kml
    def test_kml(self):
        results = self.processor.process_bytes(KML_DOCUMENT.encode(), 'places.kml')

        assert len(results) == 1
        assert results[0]['success'] is True
        assert results[0]['type'] == 'kml'
        assert results[0]['name'] == 'places'

    @requires_kml
    def test_kmz_goes_through_the_archive_path(self):
        data = kmz_bytes({'doc.kml': KML_DOCUMENT, 'files/icon.png': b'\x89PNG'})

        results = self.processor.process_bytes(data, 'Survey Area.kmz')

        assert len(results) == 1
        assert results[0]['success'] is True
        assert results[0]['type'] == 'kml'
        # doc.kml is renamed after the KMZ the user uploaded.
        assert results[0]['name'] == 'Survey Area'

    def test_kmz_without_kml_reports_no_gis_data(self):
        data = kmz_bytes({'files/icon.png': b'\x89PNG'})

        with pytest.raises(NoGISFilesFoundError):
            self.processor.process_bytes(data, 'empty.kmz')

    def test_geopackage_all_layers_reprojected(self):
        results = self.processor.process_bytes(self.geopackage_bytes(), 'project.gpkg')

        assert sorted(r['layer'] for r in results) == ['more_sites', 'sites']
        assert all(r['success'] for r in results)
        assert all(r['type'] == 'geopackage' for r in results)
        sites = next(r for r in results if r['layer'] == 'sites')
        lon, lat = sites['data']['features'][0]['geometry']['coordinates']
        assert lon == pytest.approx(-120.5, abs=0.05)
        assert lat == pytest.approx(38.25, abs=0.05)

    def test_detection_ignores_a_misleading_extension(self):
        """Content decides: a GeoPackage named .geojson is still a GeoPackage."""
        results = self.processor.process_bytes(self.geopackage_bytes(), 'wrong.geojson')

        assert all(r['type'] == 'geopackage' for r in results)

    def test_works_without_a_filename(self):
        results = self.processor.process_bytes(geojson_bytes(), None)

        assert results[0]['success'] is True
        assert results[0]['name'] == 'upload'

    def test_unsupported_file_lists_accepted_formats(self):
        with pytest.raises(UnsupportedFileTypeError) as exc_info:
            self.processor.process_bytes(b'%PDF-1.7 not gis', 'report.pdf')

        message = str(exc_info.value)
        assert 'Unsupported file type (.pdf)' in message
        for fmt in ('ZIP', '.geojson', '.kml', '.kmz', '.gpkg'):
            assert fmt in message

    def test_plain_json_without_features_is_unsupported(self):
        with pytest.raises(UnsupportedFileTypeError):
            self.processor.process_bytes(b'{"author": "someone"}', 'meta.txt')

    def test_corrupt_geopackage_is_named(self):
        data = b'SQLite format 3\x00' + b'\x00' * 200

        results = self.processor.process_bytes(data, 'broken.gpkg')

        assert len(results) == 1
        assert results[0]['success'] is False
        assert 'broken.gpkg' in results[0]['error']
        assert str(self.temp_path) not in results[0]['error']

    def test_kml_without_driver_reports_clear_error(self):
        with patch.object(gis_file_processor, 'KML_DRIVER', None):
            results = self.processor.process_bytes(KML_DOCUMENT.encode(), 'places.kml')

        assert results[0]['success'] is False
        assert 'places.kml' in results[0]['error']
        assert 'KML is not supported' in results[0]['error']


class TestDetectUploadFormat:
    @pytest.mark.parametrize('data, filename, expected', [
        (b'PK\x03\x04rest', 'a.zip', 'zip'),
        (b'PK\x03\x04rest', 'a.kmz', 'zip'),
        (b'SQLite format 3\x00rest', None, 'geopackage'),
        (b'\xef\xbb\xbf  <?xml version="1.0"?><kml>', None, 'kml'),
        (b'\n{ "type" : "FeatureCollection", "features": [] }', None, 'geojson'),
        # Leading huge geometry: no type marker in the sniff window, the
        # extension breaks the tie.
        (b'{"bbox": [' + b'1,' * 40000 + b'1]}', 'big.geojson', 'geojson'),
    ])
    def test_detects(self, data, filename, expected):
        assert detect_upload_format(data, filename) == expected

    def test_long_extension_is_not_echoed(self):
        with pytest.raises(UnsupportedFileTypeError) as exc_info:
            detect_upload_format(b'nope', 'x.' + 'a' * 50)

        assert 'aaaa' not in str(exc_info.value)


class TestSanitizeFilename:
    @pytest.mark.parametrize('raw, expected', [
        (None, None),
        ('', None),
        ('../../etc/passwd.geojson', 'passwd.geojson'),
        ('C:\\Users\\me\\sites.kml', 'sites.kml'),
        ('bad\x00name.gpkg', 'badname.gpkg'),
    ])
    def test_sanitize(self, raw, expected):
        assert sanitize_filename(raw) == expected


class TestDownloadedStandaloneFiles:
    """Through `process_url_sync`: download (HTTP mocked) → detect → process."""

    @staticmethod
    def _head(content_type):
        response = Mock()
        response.status_code = 200
        response.headers = {'content-type': content_type}
        return response

    @staticmethod
    def _get(body, content_type):
        response = Mock()
        response.status_code = 200
        response.headers = {'content-type': content_type}
        response.iter_content.return_value = [body]
        response.raise_for_status = Mock()
        return response

    @requires_kml
    @patch('app.services.file_downloader.socket.getaddrinfo')
    @patch('requests.Session.get')
    @patch('requests.Session.head')
    def test_kml_stored_as_text_plain(self, mock_head, mock_get, mock_resolve):
        """
        Uploads store KML as text/plain (its +xml type is refused by the
        upload allow list), and the storage key carries no .kml extension.
        Detection must rely on the content alone.
        """
        mock_resolve.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443)),
        ]
        mock_head.return_value = self._head('text/plain')
        mock_get.return_value = self._get(KML_DOCUMENT.encode(), 'text/plain')

        results = GISProcessor().process_url_sync(
            'https://storage.example.com/uploads/3f2a9c', 'Field Sites.kml'
        )

        assert len(results) == 1
        assert results[0]['success'] is True
        assert results[0]['type'] == 'kml'
        assert results[0]['name'] == 'Field Sites'

    @requires_kml
    @patch('app.services.file_downloader.socket.getaddrinfo')
    @patch('requests.Session.get')
    @patch('requests.Session.head')
    def test_kml_without_any_filename(self, mock_head, mock_get, mock_resolve):
        mock_resolve.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443)),
        ]
        mock_head.return_value = self._head('text/plain')
        mock_get.return_value = self._get(KML_DOCUMENT.encode(), 'text/plain')

        results = GISProcessor().process_url_sync(
            'https://storage.example.com/uploads/3f2a9c'
        )

        assert results[0]['success'] is True
        assert results[0]['type'] == 'kml'
