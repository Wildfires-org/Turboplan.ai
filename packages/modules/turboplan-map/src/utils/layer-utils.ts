/**
 * Utility functions for layer management
 */

import type { GeospatialLayer } from "../types";

/**
 * Generates a unique key for a geospatial layer
 * This ensures consistent key generation across all components
 *
 * Prefers the database id so that two layers sharing a name and source file
 * (e.g. the same file uploaded twice) stay distinct. Falls back to a
 * name/source composite for layers that have not been saved yet (previews).
 */
export function getLayerKey(layer: GeospatialLayer): string {
  if (layer.id) {
    return layer.id;
  }

  return `${layer.name}-${layer.source}-${layer.layer || "default"}`;
}

/**
 * Validates if a layer has valid data and can be displayed
 */
export function isValidLayer(layer: GeospatialLayer): boolean {
  return Boolean(
    layer.name?.trim() && layer.source?.trim() && (layer.data || layer.error),
  );
}

/**
 * Filters layers to only include those that can be displayed on the map
 */
export function getDisplayableLayers(
  layers: GeospatialLayer[],
): GeospatialLayer[] {
  return layers.filter(
    (layer) => isValidLayer(layer) && !layer.error && layer.data,
  );
}

/**
 * Gets layers that failed to load
 */
export function getFailedLayers(layers: GeospatialLayer[]): GeospatialLayer[] {
  return layers.filter((layer) => isValidLayer(layer) && layer.error);
}

/**
 * Determines which layers should be visible by default
 * Strategy: Show only unit boundaries if available, otherwise show project boundary
 */
export function getDefaultVisibleLayers(
  layers: GeospatialLayer[],
): Set<string> {
  const validLayers = layers.filter((layer) => !layer.error && layer.data);

  if (validLayers.length === 0) {
    return new Set();
  }

  // Prioritize unit layers
  const unitLayers = validLayers.filter((layer) => layer.isUnitLayer);
  if (unitLayers.length > 0) {
    return new Set(unitLayers.map((layer) => getLayerKey(layer)));
  }

  // Fall back to all layers if no unit layers
  return new Set(validLayers.map((layer) => getLayerKey(layer)));
}
