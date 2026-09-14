"use client";

import { useMemo, useState } from "react";

import {
  type GeospatialLayer,
  getDefaultVisibleLayers,
  type MapType,
  SimpleMap,
} from "@wildfires-org/turboplan-map/client";

interface PublicMapSectionProps {
  layers: GeospatialLayer[];
}

export function PublicMapSection({ layers }: PublicMapSectionProps) {
  const [mapType, setMapType] = useState<string>("openstreetmap");

  // Use getDefaultVisibleLayers to properly get default visible layer keys
  const initialLayerIds = useMemo(
    () => getDefaultVisibleLayers(layers),
    [layers],
  );
  const [visibleLayerIds, setVisibleLayerIds] =
    useState<Set<string>>(initialLayerIds);

  const handleMapTypeChange = (newMapType: MapType) => {
    setMapType(newMapType.id);
  };

  const handleToggleLayer = (layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  if (layers.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-2">🗺️</div>
          <p>No map layers available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[400px] rounded-lg overflow-hidden border border-border">
      <SimpleMap
        layers={layers}
        visibleLayerIds={visibleLayerIds}
        mapType={mapType}
        onMapTypeChange={handleMapTypeChange}
        showMapTypeSelector={true}
        showLayerSelector={true}
        onToggleLayer={handleToggleLayer}
        zoomControl={true}
        className="w-full h-full"
      />
    </div>
  );
}
