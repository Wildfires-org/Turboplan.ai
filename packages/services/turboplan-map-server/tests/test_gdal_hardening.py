"""GDAL must never follow references inside an upload to other files or URLs.

A VRT names other datasets (URLs included) and GDAL picks drivers by
content, so a VRT renamed .kml or .shp would make the server fetch whatever it
names. Each test points such a file at a local canary server and asserts the
canary received nothing.
"""

import io
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import fiona
import pytest
from fiona.env import Env

from app.core.exceptions import UnsupportedFileTypeError
from app.core.gdal_config import ALLOWED_DRIVERS, configure_gdal
from app.services.gis_file_processor import GISFileProcessorService
from app.services.gis_processor import GISProcessor

CANARY_SERVER = '''
import http.server

class Handler(http.server.BaseHTTPRequestHandler):
    def record(self):
        print(self.command, self.path, flush=True)
        self.send_response(404)
        self.end_headers()

    do_GET = do_HEAD = do_POST = record

    def log_message(self, *args):
        pass

server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
print(server.server_address[1], flush=True)
server.serve_forever()
'''


class Canary:
    """
    Local HTTP server that records every request it gets. It runs in its own
    process: Fiona keeps the GIL while GDAL fetches, so a server thread in
    the test process would never answer.
    """

    def __init__(self):
        self._process = subprocess.Popen(
            [sys.executable, '-c', CANARY_SERVER],
            stdout=subprocess.PIPE,
            text=True,
        )
        port = int(self._process.stdout.readline())
        self.url = f'http://127.0.0.1:{port}'

    def requests(self) -> list:
        """Stop the server and return the requests it received."""
        self.stop()
        output, _ = self._process.communicate(timeout=10)
        return output.splitlines()

    def stop(self) -> None:
        if self._process.poll() is None:
            self._process.terminate()


@pytest.fixture
def canary():
    server = Canary()
    try:
        yield server
    finally:
        server.stop()


def vrt_pointing_at(url: str) -> bytes:
    # The comment defeated the old "<kml anywhere in the file" sniff.
    return (
        '<OGRVRTDataSource><!-- <kml --><OGRVRTLayer name="x">'
        f'<SrcDataSource>/vsicurl/{url}/x.geojson</SrcDataSource>'
        '</OGRVRTLayer></OGRVRTDataSource>'
    ).encode()


def zip_bytes(entries) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buffer.getvalue()


def test_only_allowed_drivers_are_registered():
    with Env() as env:
        registered = set(env.drivers())

    assert registered <= ALLOWED_DRIVERS
    assert {'ESRI Shapefile', 'GPKG', 'GeoJSON', 'OpenFileGDB'} <= registered


def test_gdal_cannot_reach_the_network(canary):
    with pytest.raises(Exception):
        fiona.listlayers(f'/vsicurl/{canary.url}/data.geojson')

    assert canary.requests() == []


def test_vrt_disguised_as_kml_upload_is_rejected(canary):
    with pytest.raises(UnsupportedFileTypeError):
        GISProcessor().process_bytes(vrt_pointing_at(canary.url), 'places.kml')

    assert canary.requests() == []


def test_vrt_given_to_the_kml_reader_is_rejected(canary):
    """Past the content sniff (e.g. a .kml inside a ZIP), GDAL must still refuse."""
    with tempfile.TemporaryDirectory() as temp_dir:
        path = Path(temp_dir) / 'places.kml'
        path.write_bytes(vrt_pointing_at(canary.url))

        results = GISFileProcessorService().process_file({
            'path': str(path), 'type': 'kml', 'name': 'places',
            'display_name': 'places.kml',
        })

    assert canary.requests() == []
    assert results
    assert all(result['success'] is False for result in results)
    assert all(canary.url not in result['error'] for result in results)
    assert all(temp_dir not in result['error'] for result in results)


def test_vrt_disguised_as_shapefile_in_zip_is_rejected(canary):
    data = zip_bytes({'data/parcels.shp': vrt_pointing_at(canary.url)})

    results = GISProcessor().process_bytes(data, 'parcels.zip')

    assert canary.requests() == []
    assert len(results) == 1
    assert results[0]['success'] is False
    assert results[0]['error'].startswith('Could not read data/parcels.shp')
    assert canary.url not in results[0]['error']


@pytest.mark.parametrize('crs_type, url_key', [('url', 'url'), ('link', 'href')])
def test_geojson_crs_reference_is_not_fetched_despite_no_proxy(
    canary, monkeypatch, crs_type, url_key
):
    """
    The GeoJSON driver (which is allowed) fetches a "crs" given by URL, and
    libcurl would skip GDAL's blocking proxy for hosts listed in NO_PROXY.
    """
    monkeypatch.setenv('NO_PROXY', '127.0.0.1,localhost')
    monkeypatch.setenv('no_proxy', '127.0.0.1,localhost')
    configure_gdal()  # As at startup, with NO_PROXY in the environment.
    data = json.dumps({
        'type': 'FeatureCollection',
        'crs': {'type': crs_type, 'properties': {
            url_key: f'{canary.url}/crs-{crs_type}', 'type': 'proj4',
        }},
        'features': [{
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [-120.5, 38.25]},
            'properties': {'name': 'site'},
        }],
    }).encode()

    GISProcessor().process_bytes(data, 'sites.geojson')

    assert canary.requests() == []
    assert 'NO_PROXY' not in os.environ
    assert 'no_proxy' not in os.environ
