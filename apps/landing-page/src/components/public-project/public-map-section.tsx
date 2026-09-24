"use client";

import { useMemo, useState } from "react";

import { Map as MapIcon } from "lucide-react";

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
      <div className="flex h-[320px] w-full items-center justify-center rounded-xl bg-brandAlt-100 sm:h-[400px]">
        <div className="flex flex-col items-center gap-2 text-center font-inter text-[14px] text-egray-700">
          <MapIcon className="size-8 text-brand-800" aria-hidden />
          <p>No map layers available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[320px] overflow-hidden rounded-xl ring-1 ring-egray-200 sm:h-[400px]">
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
