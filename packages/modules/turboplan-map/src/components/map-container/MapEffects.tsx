import { useEffect } from "react";

import L from "leaflet";
import { useMap } from "react-leaflet";

import type { GeoJSONFeature, GeospatialLayer } from "../../types";
import { MAP_TYPES } from "../map-type-selector";

// Helper component to change tile layer
export function TileLayerChanger({ mapType }: { mapType: string }) {
  const map = useMap();

  useEffect(() => {
    const currentMapType =
      MAP_TYPES.find((type) => type.id === mapType) || MAP_TYPES[0];

    // Remove all existing tile layers
    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Add new tile layer
    const tileLayer = L.tileLayer(currentMapType.url, {
      attribution: currentMapType.attribution,
      maxZoom: currentMapType.maxZoom || 18,
    });

    tileLayer.addTo(map);
  }, [map, mapType]);

  return null;
}

// Helper component to fit bounds when layers change
export function FitBoundsOnLayers({ layers }: { layers: GeospatialLayer[] }) {
  const map = useMap();

  useEffect(() => {
    if (layers.length === 0) return;

    // Combine all layer bounds with proper typing
    const allFeatures: GeoJSONFeature[] = [];
    for (const layer of layers) {
      if (layer.data && layer.data.features) {
        allFeatures.push(...layer.data.features);
      }
    }

    if (allFeatures.length === 0) return;

    const combinedFeatureCollection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: allFeatures as GeoJSON.Feature[],
    };

    const geoJsonLayer = L.geoJSON(combinedFeatureCollection);
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, layers]);

  return null;
}
