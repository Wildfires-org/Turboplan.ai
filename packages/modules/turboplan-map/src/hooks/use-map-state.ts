"use client";

/**
 * Hook for managing map state and types
 */

import { useState } from "react";

import { MAP_TYPES } from "../constants";
import type { MapArtifactMetadata, MapType } from "../types";

export function useMapState(
  metadata: MapArtifactMetadata,
  setMetadata: React.Dispatch<React.SetStateAction<MapArtifactMetadata>>,
) {
  const [selectedMapType, setSelectedMapType] = useState<string>(
    metadata?.selectedMapType || MAP_TYPES.OPENSTREETMAP,
  );

  const handleMapTypeChange = (mapType: MapType) => {
    setSelectedMapType(mapType.id);
    setMetadata((prev: MapArtifactMetadata) => ({
      ...prev,
      selectedMapType: mapType.id,
    }));
  };

  return {
    selectedMapType,
    handleMapTypeChange,
  };
}
