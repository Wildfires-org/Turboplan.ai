"use client";

import React, { useMemo } from "react";

import "leaflet/dist/leaflet.css";
import "./map-styles.css"; // Import map-specific styles

import { MapContainer } from "react-leaflet";

import { cn, ZINDEX } from "@wildfires-org/turboplan-utils";

import type { BaseMapContainerProps, MapType } from "../../types";
import { getLayerKey } from "../../utils/layer-utils";
import { LayerVisibilitySelector } from "../layer-visibility-selector";
import { MapTypeSelector } from "../map-type-selector";
import { FitBoundsOnLayers, TileLayerChanger } from "./MapEffects";
import { MapLayers } from "./MapLayers";
import { EmptyState } from "./MapStates";

export function BaseMapContainer({
  mapType = "openstreetmap",
  onMapTypeChange,
  showMapTypeSelector = true,
  showLayerSelector = false,
  onToggleLayer,
  className,
  center = [41.1231618, -99.889965], // Center of USA
  zoom = 4.5,
  zoomControl = false,
  zoomSnap = 0.25,
  layers = [],
  selectedLayerId,
  visibleLayerIds,
  emptyMessage,
  emptyTitle,
  grayscale = false,
  labelPropertyKey,
  layerColors = {},
}: BaseMapContainerProps) {
  // Determine which layers to show
  const visibleLayers = useMemo(() => {
    if (layers.length === 0) {
      return [];
    }

    // If visibleLayerIds is provided, use it (supports multiple layers)
    if (visibleLayerIds) {
      return layers.filter(
        (layer) =>
          visibleLayerIds.has(getLayerKey(layer)) && !layer.error && layer.data,
      );
    }

    // Otherwise, fall back to selectedLayerId (single layer, legacy mode)
    if (selectedLayerId) {
      const found = layers.find(
        (layer) =>
          getLayerKey(layer) === selectedLayerId && !layer.error && layer.data,
      );
      return found ? [found] : [];
    }

    return [];
  }, [layers, selectedLayerId, visibleLayerIds]);

  // Handle map type change
  const handleMapTypeChange = (newMapType: MapType) => {
    if (onMapTypeChange) {
      onMapTypeChange(newMapType);
    }
  };

  // Show empty state if no layers and emptyMessage is provided
  if (layers.length === 0 && emptyMessage) {
    return (
      <EmptyState
        className={className}
        title={emptyTitle}
        message={emptyMessage}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative isolate z-10 h-full min-h-[400px] w-full overflow-hidden rounded-xl bg-brandAlt-100 dark:bg-gray-800",
        className,
      )}
    >
      {showMapTypeSelector && (
        <div
          className="absolute right-3 top-3"
          style={{ zIndex: ZINDEX.mapControl }}
        >
          <MapTypeSelector
            selectedMapType={mapType}
            onMapTypeChange={handleMapTypeChange}
          />
        </div>
      )}

      {showLayerSelector && onToggleLayer && visibleLayerIds && (
        <div
          className="absolute right-[60px] top-3"
          style={{ zIndex: ZINDEX.mapControl }}
        >
          <LayerVisibilitySelector
            layers={layers.filter((layer) => !layer.error && layer.data)}
            visibleLayerIds={visibleLayerIds}
            onToggleLayer={onToggleLayer}
            layerColors={layerColors}
          />
        </div>
      )}

      {/* Map Container */}
      <div
        className={cn(
          "overflow-hidden w-full h-full",
          grayscale && "map-grayscale",
        )}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ width: "100%", height: "100%", minHeight: "400px" }}
          zoomControl={zoomControl}
          zoomSnap={zoomSnap}
          scrollWheelZoom={true}
        >
          <TileLayerChanger mapType={mapType} />
          <FitBoundsOnLayers layers={visibleLayers} />
          <MapLayers
            layers={visibleLayers}
            allLayers={layers}
            labelPropertyKey={labelPropertyKey}
            layerColors={layerColors}
          />
        </MapContainer>
      </div>
    </div>
  );
}
