"use client";

import { useCallback, useState } from "react";

import { toast } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { getLayerKey } from "../utils/layer-utils";

interface UseMapLayersResult {
  layers: GeospatialLayer[];
  selectedLayerId: string | null;
  validLayers: GeospatialLayer[];
  errorLayers: GeospatialLayer[];
  setLayers: (layers: GeospatialLayer[]) => void;
  handleLayerSelect: (layerId: string) => void;
  handleUploadSuccess: (featureCount: number) => void;
  handleUploadError: (error: string) => void;
  resetLayers: () => void;
}

/**
 * Hook for managing geospatial layers loaded from database or uploaded
 *
 * This hook manages the layers array (typically from database via API),
 * and provides selection state to display one layer at a time.
 *
 * For multi-layer visibility control, use `useLayerVisibility` instead.
 *
 * @returns {UseMapLayersResult} Layer management state and handlers
 */
export function useMapLayers(): UseMapLayersResult {
  const [layers, setLayers] = useState<GeospatialLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const setLayersWithAutoSelect = useCallback(
    (newLayers: GeospatialLayer[]) => {
      setLayers(newLayers);

      // Auto-select first valid layer
      const firstValidLayer = newLayers.find(
        (layer) => !layer.error && layer.data,
      );
      if (firstValidLayer) {
        setSelectedLayerId(getLayerKey(firstValidLayer));
      }
    },
    [],
  );

  const handleLayerSelect = useCallback((layerId: string) => {
    setSelectedLayerId(layerId);
  }, []);

  const handleUploadSuccess = useCallback((featureCount: number) => {
    toast({
      type: "success",
      description: `Layer uploaded successfully with ${featureCount} features`,
    });
  }, []);

  const handleUploadError = useCallback((error: string) => {
    toast({
      type: "error",
      description: `Layer upload failed: ${error}`,
    });
  }, []);

  const resetLayers = useCallback(() => {
    setLayers([]);
    setSelectedLayerId(null);
  }, []);

  const validLayers = layers.filter((layer) => !layer.error);
  const errorLayers = layers.filter((layer) => layer.error);

  return {
    layers,
    selectedLayerId,
    validLayers,
    errorLayers,
    setLayers: setLayersWithAutoSelect,
    handleLayerSelect,
    handleUploadSuccess,
    handleUploadError,
    resetLayers,
  };
}
