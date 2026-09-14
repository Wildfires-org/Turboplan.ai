"""GIS file processing service using Fiona."""

import json
from typing import List, Dict, Any, Optional

import fiona
from fiona.crs import CRS
from fiona.transform import transform_geom

from app.services.geometry_optimizer import GeometryOptimizerService
from app.core.exceptions import GISFileProcessingError, LayerProcessingError, GeometryTransformError


class GISFileProcessorService:
    """Service responsible for processing individual GIS files and layers."""
    
    def __init__(self, geometry_optimizer: Optional[GeometryOptimizerService] = None):
        """
        Initialize the GIS file processor.
        
        Args:
            geometry_optimizer: Service for optimizing geometries (creates default if None)
        """
        self.geometry_optimizer = geometry_optimizer or GeometryOptimizerService()
        self.target_crs = CRS.from_epsg(4326)  # WGS84
    
    def process_file(self, gis_file: Dict[str, str]) -> List[Dict[str, Any]]:
        """
        Process a single GIS file with all its layers.
        
        Args:
            gis_file: Dictionary with 'path', 'type', and 'name' keys
            
        Returns:
            List of results for each layer
        """
        results = []
        
        try:
            # List layers in the data source
            layers = fiona.listlayers(gis_file['path'])
            
            for layer_name in layers:
                layer_result = self._process_layer(gis_file, layer_name, len(layers))
                results.append(layer_result)
                
        except Exception as file_error:
            # If we can't even list layers, return error for the whole file
            results.append(self._create_error_result(
                gis_file, None, str(file_error)
            ))
        
        return results
    
    def _process_layer(self, gis_file: Dict[str, str], layer_name: str, total_layers: int) -> Dict[str, Any]:
        """Process a single layer from a GIS file."""
        try:
            with fiona.open(gis_file['path'], layer=layer_name) as src:
                # Extract layer metadata
                layer_info = self._extract_layer_info(src)
                
                # Process features
                features = self._process_features(src)
                
                # Create GeoJSON
                geojson = {
                    'type': 'FeatureCollection',
                    'features': features
                }
                
                # Build result
                return self._create_success_result(
                    gis_file, layer_name, layer_info, geojson, total_layers
                )
                
        except Exception as layer_error:
            return self._create_error_result(
                gis_file, layer_name, str(layer_error)
            )
    
    def _extract_layer_info(self, src) -> Dict[str, Any]:
        """Extract metadata from a Fiona data source."""
        return {
            'crs': dict(src.crs) if src.crs else None,
            'driver': src.driver,
            'schema': dict(src.schema),
            'bounds': src.bounds,
            'count': len(src),
        }
    
    def _process_features(self, src) -> List[Dict[str, Any]]:
        """Process all features from a data source."""
        features = []
        
        for i, feature in enumerate(src):
            processed_feature = self._process_single_feature(feature, src.crs, i)
            if processed_feature:
                features.append(processed_feature)
        
        return features
    
    def _process_single_feature(self, feature: Dict, source_crs: CRS, index: int) -> Optional[Dict[str, Any]]:
        """Process a single feature."""
        # Skip features with null geometry
        if feature['geometry'] is None:
            return None
        
        # Get geometry as GeoJSON dict
        geometry = self._extract_geometry(feature['geometry'])
        if not geometry:
            return None
        
        # Transform to WGS84 if needed
        if source_crs and source_crs != self.target_crs:
            geometry = self._transform_geometry(geometry, source_crs, index)
            if not geometry:
                return None
        
        # Optimize geometry and properties
        optimized_geometry = self.geometry_optimizer.optimize_geometry(geometry)
        optimized_properties = self.geometry_optimizer.optimize_properties(
            feature.get('properties', {})
        )
        
        return {
            'type': 'Feature',
            'geometry': optimized_geometry,
            'properties': optimized_properties,
        }
    
    def _extract_geometry(self, geometry: Any) -> Optional[Dict[str, Any]]:
        """Extract geometry as proper GeoJSON dictionary."""
        # Handle different geometry types
        if hasattr(geometry, '__geo_interface__'):
            geometry = geometry.__geo_interface__
        elif hasattr(geometry, 'mapping'):
            geometry = geometry.mapping
        elif not isinstance(geometry, dict):
            try:
                geometry = dict(geometry)
            except:
                try:
                    geometry = json.loads(str(geometry).replace("'", '"'))
                except:
                    print(f'Warning: Could not convert geometry to dict: {type(geometry)}')
                    return None
        
        # Validate geometry structure
        if not (isinstance(geometry, dict) 
                and 'type' in geometry 
                and 'coordinates' in geometry):
            print(f'Warning: Invalid geometry format: {type(geometry)} = {geometry}')
            return None
        
        return geometry
    
    def _transform_geometry(self, geometry: Dict[str, Any], source_crs: CRS, index: int) -> Optional[Dict[str, Any]]:
        """Transform geometry to target CRS."""
        try:
            transformed_geom = transform_geom(source_crs, self.target_crs, geometry)
            
            # Extract result properly
            if hasattr(transformed_geom, '__geo_interface__'):
                return transformed_geom.__geo_interface__
            elif isinstance(transformed_geom, dict):
                return transformed_geom
            else:
                print(f'Warning: Transform returned unexpected type {type(transformed_geom)}')
                return geometry
                
        except Exception as transform_error:
            print(f'Transform error for feature {index}: {transform_error}')
            return geometry
    
    def _create_success_result(self, gis_file: Dict[str, str], layer_name: str, 
                              layer_info: Dict[str, Any], geojson: Dict[str, Any],
                              total_layers: int) -> Dict[str, Any]:
        """Create a successful result dictionary."""
        # Use composite name if multiple layers
        name = (f'{gis_file["name"]}_{layer_name}' 
                if total_layers > 1 
                else gis_file['name'])
        
        return {
            'name': name,
            'layer': layer_name,
            'source': gis_file['name'],
            'type': gis_file['type'],
            'info': layer_info,
            'data': geojson,
            'success': True,
            'error': None,
        }
    
    def _create_error_result(self, gis_file: Dict[str, str], layer_name: Optional[str], 
                            error: str) -> Dict[str, Any]:
        """Create an error result dictionary."""
        name = (f'{gis_file["name"]}_{layer_name}' 
                if layer_name 
                else gis_file['name'])
        
        return {
            'name': name,
            'layer': layer_name,
            'source': gis_file['name'],
            'type': gis_file['type'],
            'info': None,
            'data': None,
            'success': False,
            'error': error,
        }
