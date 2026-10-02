"""GIS file processing service using Fiona."""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import fiona
from fiona.crs import CRS
from fiona.env import Env
from fiona.transform import transform_geom

from app.services.geometry_optimizer import GeometryOptimizerService
from app.core.exceptions import GISFileProcessingError, LayerProcessingError, GeometryTransformError
from app.core.gdal_config import configure_gdal

logger = logging.getLogger(__name__)

# Longitude/latitude bounds. A layer without a CRS whose coordinates fall
# outside them is almost certainly projected (metres/feet) with its .prj lost.
LON_LAT_LIMITS = (-180.0, -90.0, 180.0, 90.0)

# Fallback point for testing whether a CRS converts to WGS84 when a layer's
# extent is unknown. It lies outside the domain of some projections (e.g.
# Gauss-Kruger CRSs whose false easting carries the zone number), so a failed
# transform there proves nothing.
CRS_FALLBACK_PROBE_POINT = (1.0, 1.0)

# The only driver each file type is opened with. Letting GDAL guess from the
# content would let a file pick a driver that reads other files or URLs.
# KML is resolved at call time from KML_DRIVER.
FILE_TYPE_DRIVERS = {
    'shapefile': 'ESRI Shapefile',
    'geopackage': 'GPKG',
    'geojson': 'GeoJSON',
    'gdb': 'OpenFileGDB',
}


def enable_kml_driver() -> Optional[str]:
    """
    Fiona ships with KML switched off in `supported_drivers` even when the
    bundled GDAL can read it. Turn it on (read-only) when GDAL provides it and
    return the driver name, or None when this GDAL build has no KML support.
    """
    try:
        with Env() as env:
            available = env.drivers()
    except Exception:  # pragma: no cover - GDAL environment failure
        logger.exception('Could not list GDAL drivers')
        return None

    for driver in ('LIBKML', 'KML'):
        if driver in available:
            fiona.supported_drivers.setdefault(driver, 'r')
            return driver
    return None


# Before any upload is read: restrict drivers, block GDAL's network access.
configure_gdal()
KML_DRIVER = enable_kml_driver()


class UnreadableLayerError(Exception):
    """A layer that cannot be turned into WGS84 GeoJSON; message is user-facing."""


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
        if gis_file['type'] == 'kml' and not KML_DRIVER:
            return [self._create_error_result(
                gis_file, None,
                f'{self._display_name(gis_file)}: KML is not supported by this '
                'server. Convert it to GeoJSON or GeoPackage and upload again.'
            )]

        driver = self._driver_for(gis_file['type'])
        unreadable_message = (
            f'Could not read {self._display_name(gis_file)}: the file is '
            'corrupt, incomplete (e.g. a shapefile missing its .shx or '
            '.dbf) or not a supported GIS format.'
        )
        if not driver:
            return [self._create_error_result(gis_file, None, unreadable_message)]

        results = []

        try:
            # Fiona 1.9 cannot restrict listlayers to one driver; GDAL_SKIP
            # leaves only the allowed ones registered. Each layer is then
            # opened with `driver` alone.
            layers = fiona.listlayers(gis_file['path'])
        except Exception as file_error:
            # If we can't even list layers, return error for the whole file
            logger.warning('Could not open %s: %s', gis_file['path'], file_error)
            return [self._create_error_result(gis_file, None, unreadable_message)]

        for layer_name in layers:
            layer_result = self._process_layer(
                gis_file, driver, layer_name, len(layers)
            )
            if layer_result is not None:
                results.append(layer_result)

        return results
    
    @staticmethod
    def _driver_for(file_type: str) -> Optional[str]:
        if file_type == 'kml':
            return KML_DRIVER
        return FILE_TYPE_DRIVERS.get(file_type)

    def _process_layer(self, gis_file: Dict[str, str], driver: str, layer_name: str, total_layers: int) -> Optional[Dict[str, Any]]:
        """
        Process a single layer from a GIS file.

        Returns None for layers with nothing to put on a map: no geometry
        column (e.g. GeoPackage attribute tables), no features (e.g. an empty
        KML folder) or only features without a usable geometry.
        """
        try:
            with fiona.open(gis_file['path'], driver=driver, layer=layer_name) as src:
                if src.schema.get('geometry') in (None, 'None'):
                    return None

                # GDAL cannot compute the extent of an empty layer.
                bounds = self._read_bounds(src)
                if bounds is None or len(src) == 0:
                    return None

                self._check_crs(src, bounds, gis_file, layer_name)

                # Extract layer metadata
                layer_info = self._extract_layer_info(src, bounds)

                # Process features
                features, unsupported_count = self._process_features(src)
                if not features:
                    if unsupported_count:
                        raise UnreadableLayerError(
                            f'{self._display_name(gis_file)} (layer '
                            f'"{layer_name}") was skipped: its geometry type '
                            'is not supported (e.g. GeometryCollection). Split '
                            'it into points, lines or polygons and upload again.'
                        )
                    return None

                # Create GeoJSON
                geojson = {
                    'type': 'FeatureCollection',
                    'features': features
                }
                
                # Build result
                return self._create_success_result(
                    gis_file, layer_name, layer_info, geojson, total_layers
                )
                
        except UnreadableLayerError as layer_error:
            return self._create_error_result(
                gis_file, layer_name, str(layer_error)
            )
        except Exception as layer_error:
            logger.warning(
                'Could not read layer %s of %s: %s',
                layer_name, gis_file['path'], layer_error,
            )
            return self._create_error_result(
                gis_file, layer_name,
                f'Could not read layer "{layer_name}" in '
                f'{self._display_name(gis_file)}: the data is corrupt or '
                'uses an unsupported format.'
            )

    @staticmethod
    def _read_bounds(src) -> Optional[Tuple[float, float, float, float]]:
        """The layer's extent, or None when GDAL cannot compute one."""
        try:
            bounds = tuple(src.bounds)
        except Exception:
            return None
        return bounds if len(bounds) == 4 else None

    def _check_crs(self, src, bounds, gis_file: Dict[str, str], layer_name: str) -> None:
        """
        Fail the layer with an understandable message when its coordinates
        cannot be placed on a WGS84 map.

        - No CRS (typically a shapefile without its .prj): accepted as-is when
          the bounds fit longitude/latitude, rejected otherwise.
        - A CRS that PROJ cannot transform to WGS84: rejected.
        """
        where = f'{self._display_name(gis_file)} (layer "{layer_name}")'

        if not src.crs:
            if self._bounds_look_like_lon_lat(bounds):
                return
            raise UnreadableLayerError(
                f'{where} has no coordinate system and its coordinates are '
                'not longitude/latitude. If it is a shapefile, include its '
                '.prj file in the ZIP.'
            )

        if src.crs == self.target_crs:
            return

        if not self._converts_to_target(src.crs, bounds, gis_file):
            raise UnreadableLayerError(
                f'{where} uses a coordinate system that cannot be converted '
                'to WGS84 (EPSG:4326). Re-export it in a standard coordinate '
                'system and upload again.'
            )

    def _converts_to_target(self, crs: CRS, bounds, gis_file: Dict[str, str]) -> bool:
        """
        Transform one point to WGS84: a corner of the layer's extent, which
        is inside the projection's domain, or the fallback point when the
        extent is unknown.
        """
        is_fallback = not bounds
        point = CRS_FALLBACK_PROBE_POINT if is_fallback else (bounds[0], bounds[1])

        try:
            probe = transform_geom(crs, self.target_crs, {
                'type': 'Point', 'coordinates': point,
            })
            coordinates = tuple(probe['coordinates'][:2])
        except Exception as crs_error:
            if is_fallback:
                logger.info('Inconclusive CRS probe for %s: %s', gis_file['path'], crs_error)
                return True
            logger.warning('Unsupported CRS in %s: %s', gis_file['path'], crs_error)
            return False

        # Without a path to WGS84, GDAL logs an error and hands the input
        # back unchanged. Only a geographic CRS can legitimately do that.
        if coordinates == point and not crs.is_geographic:
            logger.warning('No transformation to WGS84 for %s', gis_file['path'])
            return False
        return True

    @staticmethod
    def _bounds_look_like_lon_lat(bounds) -> bool:
        try:
            min_x, min_y, max_x, max_y = bounds
        except (TypeError, ValueError):
            return True  # Empty layer: nothing to misplace.
        lo_x, lo_y, hi_x, hi_y = LON_LAT_LIMITS
        return lo_x <= min_x <= max_x <= hi_x and lo_y <= min_y <= max_y <= hi_y

    @staticmethod
    def _display_name(gis_file: Dict[str, str]) -> str:
        """Name of the dataset inside the uploaded archive, for messages."""
        return gis_file.get('display_name') or Path(gis_file['path']).name
    
    def _extract_layer_info(self, src, bounds) -> Dict[str, Any]:
        """Extract metadata from a Fiona data source."""
        return {
            'crs': dict(src.crs) if src.crs else None,
            'driver': src.driver,
            'schema': dict(src.schema),
            'bounds': bounds,
            'count': len(src),
        }
    
    def _process_features(self, src) -> Tuple[List[Dict[str, Any]], int]:
        """
        Process all features from a data source. Returns the features and how
        many were dropped for a geometry the map cannot show.
        """
        features = []
        unsupported_count = 0

        for i, feature in enumerate(src):
            processed_feature = self._process_single_feature(feature, src.crs, i)
            if processed_feature:
                features.append(processed_feature)
            elif feature['geometry'] is not None:
                unsupported_count += 1

        return features, unsupported_count
    
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
                    logger.debug('Could not convert geometry to dict: %s', type(geometry))
                    return None
        
        # Validate geometry structure
        if not (isinstance(geometry, dict) 
                and 'type' in geometry 
                and 'coordinates' in geometry):
            # e.g. a GeometryCollection, which has no "coordinates".
            geometry_type = (geometry.get('type') if isinstance(geometry, dict)
                             else type(geometry))
            logger.debug('Unsupported geometry: %s', geometry_type)
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
                logger.warning('Transform returned unexpected type %s', type(transformed_geom))
                return geometry
                
        except Exception as transform_error:
            logger.warning('Transform error for feature %s: %s', index, transform_error)
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
