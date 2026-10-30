"""Unit tests for GeometryOptimizerService."""

import pytest
import math

from app.services.geometry_optimizer import GeometryOptimizerService


class TestGeometryOptimizerService:
    """Test suite for GeometryOptimizerService."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = GeometryOptimizerService(coordinate_precision=6)
    
    def test_optimize_point_geometry(self):
        """Test optimization of point geometry."""
        geometry = {
            'type': 'Point',
            'coordinates': [10.123456789, 20.987654321, 100.5]  # With elevation
        }
        
        result = self.service.optimize_geometry(geometry)
        
        assert result['type'] == 'Point'
        assert result['coordinates'] == [10.123457, 20.987654]  # Rounded to 6 decimals, elevation removed
    
    def test_optimize_linestring_geometry(self):
        """Test optimization of LineString geometry."""
        geometry = {
            'type': 'LineString',
            'coordinates': [
                [10.123456789, 20.987654321],
                [11.111111111, 22.222222222],
                [12.999999999, 23.000000001]
            ]
        }
        
        result = self.service.optimize_geometry(geometry)
        
        assert result['type'] == 'LineString'
        assert len(result['coordinates']) == 3
        assert result['coordinates'][0] == [10.123457, 20.987654]
        assert result['coordinates'][2] == [13.0, 23.0]
    
    def test_optimize_polygon_geometry(self):
        """Test optimization of Polygon geometry."""
        geometry = {
            'type': 'Polygon',
            'coordinates': [[
                [0.123456789, 0.123456789],
                [1.0, 0.0],
                [1.0, 1.0],
                [0.0, 1.0],
                [0.123456789, 0.123456789]
            ]]
        }
        
        result = self.service.optimize_geometry(geometry)
        
        assert result['type'] == 'Polygon'
        assert result['coordinates'][0][0] == [0.123457, 0.123457]
        assert result['coordinates'][0][-1] == [0.123457, 0.123457]  # Closure preserved
    
    # Fiona returns a Point's coordinates as one tuple and the other types as
    # lists of tuples, with Z kept for 3D sources (KML, 3D shapefiles).
    @pytest.mark.parametrize('geometry_type, coordinates, expected', [
        ('Point',
         (-120.123456789012, 38.987654321098, 512.3),
         [-120.123457, 38.987654]),
        ('LineString',
         [(-121.49440000000001, 38.581599999999995, 1.5),
          (-120.2, 38.222222222222, 2.5)],
         [[-121.4944, 38.5816], [-120.2, 38.222222]]),
        ('Polygon',
         [[(-120.0000004, 38.0, 0.0), (-119.0, 38.0000007, 0.0),
           (-119.0, 39.0, 0.0), (-120.0000004, 38.0, 0.0)]],
         [[[-120.0, 38.0], [-119.0, 38.000001], [-119.0, 39.0], [-120.0, 38.0]]]),
        ('MultiPoint',
         [(-120.44999999999999, 38.25000000000001, 512.3),
          (-13.987654321, 51.5555555555)],
         [[-120.45, 38.25], [-13.987654, 51.555556]]),
        ('MultiLineString',
         [[(-120.123456789012, 38.1, 3.0), (-120.2, 38.987654321098, 4.0)]],
         [[[-120.123457, 38.1], [-120.2, 38.987654]]]),
        ('MultiPolygon',
         [[[(-120.0000004, 38.0, 1.0), (-119.0, 38.0000007, 1.0),
            (-119.0, 39.0, 1.0), (-120.0000004, 38.0, 1.0)]]],
         [[[[-120.0, 38.0], [-119.0, 38.000001], [-119.0, 39.0], [-120.0, 38.0]]]]),
        # Tuples at every depth, not only for positions.
        ('MultiLineString',
         (((-120.123456789012, 38.1, 3.0), (-120.2, 38.987654321098, 4.0)),),
         [[[-120.123457, 38.1], [-120.2, 38.987654]]]),
    ])
    def test_optimize_tuple_coordinates(self, geometry_type, coordinates, expected):
        """Test that fiona's tuple coordinates are rounded and made 2D."""
        geometry = {'type': geometry_type, 'coordinates': coordinates}

        result = self.service.optimize_geometry(geometry)

        # Lists (not tuples) compare equal only to lists: output is plain JSON.
        assert result == {'type': geometry_type, 'coordinates': expected}

    def test_optimize_list_coordinates_with_elevation(self):
        """Test that GeoJSON-style list coordinates also lose Z at every depth."""
        geometry = {
            'type': 'MultiPolygon',
            'coordinates': [[[
                [-120.123456789012, 38.987654321098, 512.3],
                [-119.0, 38.0000007, 512.3],
                [-119.0, 39.0, 512.3],
                [-120.123456789012, 38.987654321098, 512.3],
            ]]]
        }

        result = self.service.optimize_geometry(geometry)

        assert result['coordinates'] == [[[
            [-120.123457, 38.987654],
            [-119.0, 38.000001],
            [-119.0, 39.0],
            [-120.123457, 38.987654],
        ]]]

    def test_invalid_geometry_handling(self):
        """Test handling of invalid geometries."""
        invalid_geometries = [
            None,
            {},
            {'type': 'Point'},  # Missing coordinates
            {'coordinates': [10, 20]},  # Missing type
            "not a dict"
        ]
        
        for geom in invalid_geometries:
            result = self.service.optimize_geometry(geom)
            assert result == geom  # Should return unchanged
    
    def test_optimize_properties_null_handling(self):
        """Test that null values are removed from properties."""
        properties = {
            'name': 'Test Feature',
            'value': None,
            'count': 42,
            'empty': None
        }
        
        result = self.service.optimize_properties(properties)
        
        assert 'name' in result
        assert 'value' not in result
        assert 'empty' not in result
        assert result['count'] == 42
    
    def test_optimize_properties_nan_handling(self):
        """Test that NaN values are removed from properties."""
        properties = {
            'valid_float': 3.14159,
            'nan_value': float('nan'),
            'infinity': float('inf')
        }
        
        result = self.service.optimize_properties(properties)
        
        assert 'valid_float' in result
        assert 'nan_value' not in result
        assert 'infinity' in result  # Infinity is kept
    
    def test_optimize_properties_string_truncation(self):
        """Test string truncation for non-important fields."""
        long_string = 'x' * 150
        properties = {
            'random_field': long_string,
            'name': long_string,  # Important field
            'description': long_string,  # Important field
            'other_data': long_string
        }
        
        result = self.service.optimize_properties(properties)
        
        assert len(result['random_field']) == 103  # 100 + '...'
        assert len(result['name']) == 150  # Not truncated
        assert len(result['description']) == 150  # Not truncated (important field)
        assert result['random_field'].endswith('...')
    
    def test_optimize_properties_empty_string_removal(self):
        """Test removal of empty strings."""
        properties = {
            'name': 'Feature',
            'empty': '',
            'whitespace': '   ',
            'valid': 'value'
        }
        
        result = self.service.optimize_properties(properties)
        
        assert 'name' in result
        assert 'empty' not in result
        assert 'whitespace' not in result
        assert result['valid'] == 'value'
    
    def test_optimize_properties_float_rounding(self):
        """Test float value rounding based on field type."""
        properties = {
            'area': 12345.6789,
            'Shape_Area': 9876.54321,
            'elevation': 123.456,
            'height': 45.678,
            'random_float': 3.14159265359
        }
        
        result = self.service.optimize_properties(properties)
        
        # When both 'area' and 'Shape_Area' exist, 'Shape_Area' renamed to 'area' overwrites original
        assert result['area'] == 9876.54  # Shape_Area takes precedence after renaming
        assert result['elevation'] == 123.5  # 1 decimal (not renamed since lowercase)
        assert result['height'] == 45.7  # 1 decimal
        assert result['random_float'] == 3.142  # 3 decimals
    
    def test_field_name_shortening(self):
        """Test field name abbreviations."""
        properties = {
            'OBJECTID': 123,
            'SHAPE_Length': 456.789,
            'DESCRIPTION': 'Test description',
            'POPULATION': 1000000,
            'custom_field': 'value'
        }
        
        result = self.service.optimize_properties(properties)
        
        assert 'id' in result and result['id'] == 123
        assert 'len' in result and result['len'] == 456.79
        assert 'desc' in result and result['desc'] == 'Test description'
        assert 'pop' in result and result['pop'] == 1000000
        assert 'custom_field' in result  # Not abbreviated
