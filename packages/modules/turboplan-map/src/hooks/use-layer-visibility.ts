"use client";

import { useCallback, useState } from "react";

import type { GeospatialLayer } from "../types";
import { getLayerKey } from "../utils/layer-utils";

interface UseLayerVisibilityResult {
  visibleLayerIds: Set<string>;
  toggleLayerVisibility: (layerId: string) => void;
  showLayer: (layerId: string) => void;
  hideLayer: (layerId: string) => void;
  setVisibleLayers: (layerIds: Set<string>) => void;
  showAllLayers: (layers: GeospatialLayer[]) => void;
  hideAllLayers: () => void;
}

/**
 * Hook for managing which layers are visible on the map
 * Supports showing multiple layers at once
 */
export function useLayerVisibility(
  initialVisibleLayers: Set<string> = new Set(),
): UseLayerVisibilityResult {
  const [visibleLayerIds, setVisibleLayerIds] =
    useState<Set<string>>(initialVisibleLayers);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  const showLayer = useCallback((layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      next.add(layerId);
      return next;
    });
  }, []);

  const hideLayer = useCallback((layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      next.delete(layerId);
      return next;
    });
  }, []);

  const setVisibleLayers = useCallback((layerIds: Set<string>) => {
    setVisibleLayerIds(new Set(layerIds));
  }, []);

  const showAllLayers = useCallback((layers: GeospatialLayer[]) => {
    const allLayerIds = layers
      .filter((layer) => !layer.error && layer.data)
      .map((layer) => getLayerKey(layer));
    setVisibleLayerIds(new Set(allLayerIds));
  }, []);

  const hideAllLayers = useCallback(() => {
    setVisibleLayerIds(new Set());
  }, []);

  return {
    visibleLayerIds,
    toggleLayerVisibility,
    showLayer,
    hideLayer,
    setVisibleLayers,
    showAllLayers,
    hideAllLayers,
  };
}
