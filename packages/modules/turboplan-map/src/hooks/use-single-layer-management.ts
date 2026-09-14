"use client";

/**
 * Hook for managing single layer selection
 */

import { useEffect, useState } from "react";

import type { MapArtifactMetadata, ServerResponse } from "../types";
import { getLayerKey } from "../utils/layer-utils";

export function useSingleLayerManagement(
  layers: ServerResponse,
  setMetadata: React.Dispatch<React.SetStateAction<MapArtifactMetadata>>,
) {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Auto-select first valid layer if none selected
  useEffect(() => {
    if (layers.length > 0 && !selectedLayerId) {
      const firstValidLayer = layers.find(
        (layer) => !layer.error && layer.data,
      );
      if (firstValidLayer) {
        const layerKey = getLayerKey(firstValidLayer);
        setSelectedLayerId(layerKey);
        setMetadata((prev: MapArtifactMetadata) => ({
          ...prev,
          selectedLayerId: layerKey,
        }));
      }
    }
  }, [layers, selectedLayerId, setMetadata]);

  // Handle layer selection
  const handleLayerSelect = (layerId: string) => {
    setSelectedLayerId(layerId);
    setMetadata((prev: MapArtifactMetadata) => ({
      ...prev,
      selectedLayerId: layerId,
    }));
  };

  return {
    selectedLayerId,
    handleLayerSelect,
  };
}
