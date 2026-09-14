/**
 * Layer status analysis utility
 * Following Single Responsibility Principle - only responsible for analyzing layer status
 */
import type { GeospatialLayer, Layer, ProjectLayersSummary } from "../types";

/**
 * Analyzes geospatial layers to determine which layer types exist
 * @param layers Array of geospatial layers from the database
 * @returns Summary of layer status for project and units boundaries
 */
export function analyzeLayerStatus(
  layers: GeospatialLayer[],
): ProjectLayersSummary {
  const projectBoundary = layers.find((layer) => !layer.isUnitLayer);
  const unitsBoundary = layers.find((layer) => layer.isUnitLayer === true);

  return {
    projectBoundary: {
      type: "project_boundary",
      exists: !!projectBoundary,
      layerId: projectBoundary?.id,
      name: projectBoundary?.name,
      featureCount: projectBoundary?.data?.features?.length || 0,
    },
    unitsBoundary: {
      type: "units_boundary",
      exists: !!unitsBoundary,
      layerId: unitsBoundary?.id,
      name: unitsBoundary?.name,
      featureCount: unitsBoundary?.data?.features?.length || 0,
    },
    hasAnyLayers: layers.length > 0,
  };
}
