"""End-to-end tests for the formats accepted inside an uploaded ZIP.

Fixtures are generated with Fiona inside each test rather than committed as
binaries, then zipped and run through the same extract → find → process path
the upload endpoint uses.
"""

import json
import shutil
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch

import fiona
import pytest

from app.core.exceptions import NoGISFilesFoundError
from app.services import gis_file_processor
from app.services.gis_processor import GISProcessor
from app.services.zip_extractor import ZipExtractorService

POINT_SCHEMA = {'geometry': 'Point', 'properties': {'name': 'str'}}
POLYGON_SCHEMA = {'geometry': 'Polygon', 'properties': {'name': 'str'}}

LON_LAT_POINT = {'type': 'Point', 'coordinates': (-120.5, 38.25)}
# Same place in Web Mercator metres, so reprojection is observable.
MERCATOR_POINT = {'type': 'Point', 'coordinates': (-13414011.0, 4612285.0)}
SQUARE = {
    'type': 'Polygon',
    'coordinates': [[(-120.0, 38.0), (-119.0, 38.0), (-119.0, 39.0),
                     (-120.0, 39.0), (-120.0, 38.0)]],
}

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


class TestGISFormats:
    def setup_method(self):
        self.temp_path = Path(tempfile.mkdtemp())
        self.source = self.temp_path / 'source'
        self.source.mkdir()
        self.work = self.temp_path / 'work'
        self.work.mkdir()
        self.processor = GISProcessor()

    def teardown_method(self):
        shutil.rmtree(self.temp_path, ignore_errors=True)

    # -- helpers ---------------------------------------------------------

    def write_layer(self, relative, driver, schema, features, crs='EPSG:4326', layer=None):
        path = self.source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        kwargs = {'driver': driver, 'schema': schema}
        if crs:
            kwargs['crs'] = crs
        if layer:
            kwargs['layer'] = layer
        with fiona.open(path, 'w', **kwargs) as dst:
            for geometry, name in features:
                dst.write({'geometry': geometry, 'properties': {'name': name}})
        return path

    def write_text(self, relative, content):
        path = self.source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def process_source(self):
        zip_path = self.temp_path / 'upload.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for file in sorted(self.source.rglob('*')):
                if file.is_file():
                    zf.write(file, file.relative_to(self.source).as_posix())
        return self.processor._process_zip_file(zip_path, self.work)

    @staticmethod
    def successes(results):
        return [r for r in results if r['success']]

    # -- formats ---------------------------------------------------------

    def test_geopackage_all_spatial_layers_reprojected(self):
        gpkg = 'deep/nested/folder/project.gpkg'
        self.write_layer(gpkg, 'GPKG', POINT_SCHEMA, [(MERCATOR_POINT, 'a')],
                         crs='EPSG:3857', layer='sites')
        self.write_layer(gpkg, 'GPKG', POLYGON_SCHEMA, [(SQUARE, 'b')],
                         layer='boundary')
        # Attribute-only table: nothing to draw, must be skipped silently.
        path = self.source / gpkg
        with fiona.open(path, 'w', driver='GPKG', layer='notes',
                        schema={'geometry': 'None', 'properties': {'name': 'str'}}) as dst:
            dst.write({'geometry': None, 'properties': {'name': 'x'}})

        results = self.process_source()

        assert sorted(r['layer'] for r in results) == ['boundary', 'sites']
        assert all(r['success'] for r in results)
        assert all(r['type'] == 'geopackage' for r in results)
        sites = next(r for r in results if r['layer'] == 'sites')
        lon, lat = sites['data']['features'][0]['geometry']['coordinates']
        assert lon == pytest.approx(-120.5, abs=0.05)
        assert lat == pytest.approx(38.25, abs=0.05)

    def test_geojson_and_json_feature_collections(self):
        self.write_text('data/sites.geojson', json.dumps(FEATURE_COLLECTION))
        self.write_text('data/more.json', json.dumps(FEATURE_COLLECTION, indent=2))
        # Plain metadata JSON next to the data must not be picked up.
        self.write_text('data/metadata.json', json.dumps({'author': 'someone'}))

        results = self.process_source()

        assert sorted(r['name'] for r in results) == ['more', 'sites']
        assert all(r['success'] for r in results)
        assert all(r['type'] == 'geojson' for r in results)

    def test_nested_shapefile_ignores_macos_and_hidden_entries(self):
        self.write_layer('a/b/parcels.shp', 'ESRI Shapefile', POLYGON_SCHEMA,
                         [(SQUARE, 'p')])
        self.write_text('__MACOSX/a/b/._parcels.shp', 'resource fork')
        self.write_text('a/b/.hidden.geojson', json.dumps(FEATURE_COLLECTION))

        results = self.process_source()

        assert [r['name'] for r in results] == ['parcels']
        assert results[0]['success'] is True

    def test_kml_is_read_when_gdal_supports_it(self):
        if not gis_file_processor.KML_DRIVER:
            pytest.skip('GDAL build without a KML driver')
        self.write_text('places.kml', KML_DOCUMENT)

        results = self.process_source()

        assert len(self.successes(results)) == 1
        assert results[0]['type'] == 'kml'

    def test_kml_without_driver_reports_clear_error(self):
        self.write_text('places.kml', KML_DOCUMENT)

        with patch.object(gis_file_processor, 'KML_DRIVER', None):
            results = self.process_source()

        assert len(results) == 1
        assert results[0]['success'] is False
        assert 'places.kml' in results[0]['error']
        assert 'KML is not supported' in results[0]['error']

    # -- error messages --------------------------------------------------

    def test_no_gis_data_lists_supported_formats(self):
        self.write_text('readme.txt', 'nothing to see')
        self.write_text('config.json', '{"a": 1}')

        with pytest.raises(NoGISFilesFoundError) as exc_info:
            self.process_source()

        message = str(exc_info.value)
        assert 'No GIS data found' in message
        for fmt in ('.shp', '.gdb', '.gpkg', '.geojson', '.kml'):
            assert fmt in message

    def test_corrupt_file_is_named(self):
        self.write_text('folder/broken.gpkg', 'definitely not sqlite')

        results = self.process_source()

        assert len(results) == 1
        assert results[0]['success'] is False
        assert 'folder/broken.gpkg' in results[0]['error']
        assert str(self.work) not in results[0]['error']

    def test_projected_shapefile_without_prj_is_rejected(self):
        shp = self.write_layer('utm.shp', 'ESRI Shapefile', POINT_SCHEMA,
                               [({'type': 'Point', 'coordinates': (500000, 4200000)}, 'x')],
                               crs=None)
        shp.with_suffix('.prj').unlink(missing_ok=True)

        results = self.process_source()

        assert results[0]['success'] is False
        assert '.prj' in results[0]['error']
        assert 'utm.shp' in results[0]['error']

    def test_lon_lat_shapefile_without_prj_is_accepted(self):
        shp = self.write_layer('wgs.shp', 'ESRI Shapefile', POINT_SCHEMA,
                               [(LON_LAT_POINT, 'x')], crs=None)
        shp.with_suffix('.prj').unlink(missing_ok=True)

        results = self.process_source()

        assert results[0]['success'] is True


class TestFindGisFilesExtras:
    def setup_method(self):
        self.root = Path(tempfile.mkdtemp())
        self.service = ZipExtractorService()

    def teardown_method(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_files_inside_geodatabase_are_not_separate_datasets(self):
        gdb = self.root / 'data.gdb'
        gdb.mkdir()
        (gdb / 'a00000001.gdbtable').touch()
        (gdb / 'stray.json').write_text(json.dumps(FEATURE_COLLECTION))

        result = self.service.find_gis_files(self.root)

        assert [(f['type'], f['display_name']) for f in result] == [('gdb', 'data.gdb')]

    def test_display_name_is_path_inside_archive(self):
        nested = self.root / 'x' / 'y'
        nested.mkdir(parents=True)
        (nested / 'layer.GeoJSON').write_text(json.dumps(FEATURE_COLLECTION))

        result = self.service.find_gis_files(self.root)

        assert result[0]['display_name'] == 'x/y/layer.GeoJSON'
        assert result[0]['type'] == 'geojson'
