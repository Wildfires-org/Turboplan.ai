"""Geometry optimization service for web display."""

import math
from typing import Dict, Any, List, Union


class GeometryOptimizerService:
    """Service responsible for optimizing GIS geometries and properties for web display."""
    
    def __init__(self, coordinate_precision: int = 6):
        """
        Initialize the geometry optimizer.
        
        Args:
            coordinate_precision: Decimal places for coordinates (default 6 = ~10cm accuracy)
        """
        self.coordinate_precision = coordinate_precision
        self.max_string_length = 100
        self.important_string_fields = ['name', 'title', 'label', 'description', 'addr', 'address']
        
    def optimize_geometry(self, geometry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize geometry for web display while preserving visual quality.
        
        Args:
            geometry: GeoJSON geometry dictionary
            
        Returns:
            Optimized geometry dictionary
        """
        if not self._is_valid_geometry(geometry):
            return geometry
        
        optimized = geometry.copy()
        coords = geometry.get('coordinates')
        
        if coords:
            optimized['coordinates'] = self._optimize_coordinates(coords)
        
        return optimized
    
    def optimize_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize feature properties to reduce JSON size.
        
        Args:
            properties: Feature properties dictionary
            
        Returns:
            Optimized properties dictionary
        """
        if not properties:
            return {}
        
        cleaned = {}
        
        for key, value in properties.items():
            # Skip null/None values
            if value is None:
                continue
            
            # Skip NaN values
            if isinstance(value, float) and math.isnan(value):
                continue
            
            # Process strings
            if isinstance(value, str):
                processed_value = self._process_string_value(key, value)
                if processed_value is not None:
                    cleaned[self._shorten_field_name(key)] = processed_value
            
            # Process floats
            elif isinstance(value, float):
                cleaned[self._shorten_field_name(key)] = self._process_float_value(key, value)
            
            # Keep other types as-is
            else:
                cleaned[self._shorten_field_name(key)] = value
        
        return cleaned
    
    def _is_valid_geometry(self, geometry: Any) -> bool:
        """Check if geometry is valid GeoJSON geometry."""
        return (
            geometry 
            and isinstance(geometry, dict) 
            and 'coordinates' in geometry
        )
    
    def _optimize_coordinates(self, coords: Any) -> Any:
        """Recursively optimize coordinates."""
        if isinstance(coords, list):
            if coords and isinstance(coords[0], (int, float)):
                # Coordinate pair [lon, lat] or [lon, lat, elevation]
                # Remove elevation if present and round coordinates
                return [round(c, self.coordinate_precision) for c in coords[:2]]
            else:
                # Nested array
                return [self._optimize_coordinates(c) for c in coords]
        return coords
    
    def _process_string_value(self, key: str, value: str) -> Union[str, None]:
        """Process string value - truncate if needed, skip if empty."""
        # Skip empty strings
        if not value.strip():
            return None
        
        # Truncate long strings except important ones
        if len(value) > self.max_string_length:
            if not any(imp in key.lower() for imp in self.important_string_fields):
                return value[:self.max_string_length] + '...'
        
        return value
    
    def _process_float_value(self, key: str, value: float) -> float:
        """Round float values based on field type."""
        key_lower = key.lower()
        
        if 'area' in key_lower or 'length' in key_lower:
            return round(value, 2)  # 2 decimal places for areas/lengths
        elif 'elevation' in key_lower or 'height' in key_lower:
            return round(value, 1)  # 1 decimal place for heights
        else:
            return round(value, 3)  # 3 decimal places for other floats
    
    def _shorten_field_name(self, field_name: str) -> str:
        """Shorten common long field names to reduce JSON size."""
        abbreviations = {
            'OBJECTID': 'id',
            'OBJECT_ID': 'id',
            'FID': 'id',
            'SHAPE_Length': 'len',
            'SHAPE_Area': 'area',
            'Shape_Length': 'len',
            'Shape_Area': 'area',
            'GEOMETRY_Length': 'len',
            'GEOMETRY_Area': 'area',
            'NAME': 'name',
            'DESCRIPTION': 'desc',
            'CATEGORY': 'cat',
            'TYPE': 'type',
            'STATUS': 'status',
            'ELEVATION': 'elev',
            'POPULATION': 'pop',
        }
        
        return abbreviations.get(field_name, field_name)
