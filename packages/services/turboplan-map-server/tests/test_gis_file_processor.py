"""Unit tests for GISFileProcessorService."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fiona.crs import CRS

from app.services.gis_file_processor import GISFileProcessorService
from app.services.geometry_optimizer import GeometryOptimizerService


class TestGISFileProcessorService:
    """Test suite for GISFileProcessorService."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.geometry_optimizer = Mock(spec=GeometryOptimizerService)
        self.service = GISFileProcessorService(self.geometry_optimizer)
    
    @patch('fiona.listlayers')
    def test_process_file_list_layers_error(self, mock_listlayers):
        """Test handling when listing layers fails."""
        mock_listlayers.side_effect = Exception("Cannot read file")
        
        gis_file = {
            'path': '/path/to/file.shp',
            'type': 'shapefile',
            'name': 'test_file'
        }
        
        results = self.service.process_file(gis_file)
        
        assert len(results) == 1
        assert results[0]['success'] is False
        assert results[0]['error'] == "Cannot read file"
        assert results[0]['name'] == 'test_file'
    
    @patch('fiona.listlayers')
    @patch('fiona.open')
    def test_process_file_single_layer_success(self, mock_fiona_open, mock_listlayers):
        """Test successful processing of single layer file."""
        mock_listlayers.return_value = ['layer1']
        
        # Mock fiona data source
        mock_src = MagicMock()
        mock_src.crs = CRS.from_epsg(4326)
        mock_src.driver = 'ESRI Shapefile'
        mock_src.schema = {'properties': {'name': 'str'}, 'geometry': 'Point'}
        mock_src.bounds = (0, 0, 10, 10)
        mock_src.__len__ = Mock(return_value=2)
        
        # Mock features
        feature1 = {
            'geometry': {'type': 'Point', 'coordinates': [1, 1]},
            'properties': {'name': 'Feature 1'}
        }
        feature2 = {
            'geometry': {'type': 'Point', 'coordinates': [2, 2]},
            'properties': {'name': 'Feature 2'}
        }
        mock_src.__iter__ = Mock(return_value=iter([feature1, feature2]))
        mock_src.__enter__ = Mock(return_value=mock_src)
        mock_src.__exit__ = Mock(return_value=None)
        
        mock_fiona_open.return_value = mock_src
        
        # Mock geometry optimizer
        self.geometry_optimizer.optimize_geometry.side_effect = lambda g: g
        self.geometry_optimizer.optimize_properties.side_effect = lambda p: p
        
        gis_file = {
            'path': '/path/to/file.shp',
            'type': 'shapefile',
            'name': 'test_file'
        }
        
        results = self.service.process_file(gis_file)
        
        assert len(results) == 1
        assert results[0]['success'] is True
        assert results[0]['name'] == 'test_file'
        assert results[0]['layer'] == 'layer1'
        assert results[0]['data']['type'] == 'FeatureCollection'
        assert len(results[0]['data']['features']) == 2
    
    @patch('fiona.listlayers')
    @patch('fiona.open')
    def test_process_file_multiple_layers(self, mock_fiona_open, mock_listlayers):
        """Test processing file with multiple layers."""
        mock_listlayers.return_value = ['layer1', 'layer2']
        
        # Create mock for each layer
        mock_src = MagicMock()
        mock_src.crs = None
        mock_src.driver = 'FileGDB'
        mock_src.schema = {'properties': {}, 'geometry': 'Point'}
        mock_src.bounds = None
        mock_src.__len__ = Mock(return_value=1)
        
        feature = {
            'geometry': {'type': 'Point', 'coordinates': [0, 0]},
            'properties': {}
        }
        mock_src.__iter__ = Mock(return_value=iter([feature]))
        mock_src.__enter__ = Mock(return_value=mock_src)
        mock_src.__exit__ = Mock(return_value=None)
        
        mock_fiona_open.return_value = mock_src
        
        # Mock geometry optimizer
        self.geometry_optimizer.optimize_geometry.side_effect = lambda g: g
        self.geometry_optimizer.optimize_properties.return_value = {}
        
        gis_file = {
            'path': '/path/to/file.gdb',
            'type': 'gdb',
            'name': 'test_gdb'
        }
        
        results = self.service.process_file(gis_file)
        
        assert len(results) == 2
        assert results[0]['name'] == 'test_gdb_layer1'
        assert results[1]['name'] == 'test_gdb_layer2'
        assert all(r['success'] for r in results)
    
    @patch('fiona.listlayers')
    @patch('fiona.open')
    def test_process_layer_error(self, mock_fiona_open, mock_listlayers):
        """Test handling of layer processing error."""
        mock_listlayers.return_value = ['layer1']
        mock_fiona_open.side_effect = Exception("Cannot open layer")
        
        gis_file = {
            'path': '/path/to/file.shp',
            'type': 'shapefile',
            'name': 'test_file'
        }
        
        results = self.service.process_file(gis_file)
        
        assert len(results) == 1
        assert results[0]['success'] is False
        assert results[0]['error'] == "Cannot open layer"
    
    def test_process_single_feature_null_geometry(self):
        """Test that features with null geometry are skipped."""
        feature = {
            'geometry': None,
            'properties': {'name': 'Null geometry feature'}
        }
        
        result = self.service._process_single_feature(feature, None, 0)
        
        assert result is None
    
    @patch('app.services.gis_file_processor.transform_geom')
    def test_process_single_feature_transform_error(self, mock_transform):
        """Test handling of coordinate transformation errors."""
        feature = {
            'geometry': {'type': 'Point', 'coordinates': [100, 50]},
            'properties': {'name': 'Test'}
        }
        source_crs = CRS.from_epsg(3857)
        
        mock_transform.side_effect = Exception("Transform failed")
        
        # Mock geometry optimizer
        self.geometry_optimizer.optimize_geometry.side_effect = lambda g: g
        self.geometry_optimizer.optimize_properties.side_effect = lambda p: p
        
        result = self.service._process_single_feature(feature, source_crs, 0)
        
        # Should return original geometry on transform error
        assert result is not None
        assert result['geometry']['coordinates'] == [100, 50]
    
    def test_extract_geometry_various_formats(self):
        """Test extraction of geometry from various formats."""
        # Test dict geometry
        geom_dict = {'type': 'Point', 'coordinates': [1, 2]}
        result = self.service._extract_geometry(geom_dict)
        assert result == geom_dict
        
        # Test object with __geo_interface__
        mock_obj = Mock()
        mock_obj.__geo_interface__ = geom_dict
        result = self.service._extract_geometry(mock_obj)
        assert result == geom_dict
        
        # Test invalid geometry
        result = self.service._extract_geometry("invalid")
        assert result is None
        
        # Test incomplete geometry
        incomplete = {'type': 'Point'}  # Missing coordinates
        result = self.service._extract_geometry(incomplete)
        assert result is None
