"use client";

import React from "react";

import { MAP_TYPES } from "../constants";
import type { BaseMapContainerProps } from "../types";
import { BaseMapContainer } from "./map-container";

/**
 * SimpleMap - A clean map component without the layers UI
 *
 * Use this component when you want to display a map without the layer management interface.
 * It supports optional GeoJSON layers but doesn't require them.
 *
 * @example
 * ```tsx
 * // Simple map without any layers (default: center of USA)
 * <SimpleMap />
 *
 * // Map with custom location
 * <SimpleMap center={[40.7128, -74.0060]} zoom={10} zoomControl={true} />
 *
 * // Map with grayscale filter
 * <SimpleMap grayscale={true} />
 *
 * // Map with layers but no empty state
 * <SimpleMap
 *   layers={myLayers}
 *   selectedLayerId="layer-1"
 *   showMapTypeSelector={false}
 * />
 * ```
 */
export function SimpleMap({
  mapType = MAP_TYPES.OPENSTREETMAP,
  onMapTypeChange,
  showMapTypeSelector = false,
  showLayerSelector = false,
  onToggleLayer,
  className,
  center = [41.1231618, -99.889965], // Default to center of USA
  zoom = 4.5,
  zoomControl = false,
  zoomSnap = 0.25,
  layers,
  selectedLayerId,
  visibleLayerIds,
  grayscale = false,
  labelPropertyKey,
  layerColors,
}: BaseMapContainerProps) {
  return (
    <BaseMapContainer
      mapType={mapType}
      onMapTypeChange={onMapTypeChange}
      showMapTypeSelector={showMapTypeSelector}
      showLayerSelector={showLayerSelector}
      onToggleLayer={onToggleLayer}
      className={className}
      center={center}
      zoom={zoom}
      zoomControl={zoomControl}
      zoomSnap={zoomSnap}
      layers={layers}
      selectedLayerId={selectedLayerId}
      visibleLayerIds={visibleLayerIds}
      grayscale={grayscale}
      labelPropertyKey={labelPropertyKey}
      layerColors={layerColors}
    />
  );
}
