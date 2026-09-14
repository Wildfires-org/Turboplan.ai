"use client";

import React, { useCallback, useMemo, useState } from "react";

import { ChevronDown, Loader2, MapPin } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import {
  getDisplayableLayers,
  getFailedLayers,
  getLayerKey,
} from "../utils/layer-utils";
import { FailedLayerItem } from "./failed-layer-item";
import { LayerSelectorItem } from "./layer-selector-item";

interface LayerSelectorProps {
  layers: GeospatialLayer[];
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string) => void;
}

// Using centralized utility functions for layer management

export function LayerSelector({
  layers,
  selectedLayerId,
  onLayerSelect,
}: LayerSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);

  // Memoized layer filtering for performance
  const validLayers = useMemo(() => getDisplayableLayers(layers), [layers]);
  const failedLayers = useMemo(() => getFailedLayers(layers), [layers]);

  const selectedLayer = useMemo(
    () => validLayers.find((layer) => getLayerKey(layer) === selectedLayerId),
    [validLayers, selectedLayerId],
  );

  const handleLayerSelect = useCallback(
    async (layerId: string) => {
      setIsSelecting(true);
      try {
        onLayerSelect(layerId);
      } finally {
        setIsSelecting(false);
      }
    },
    [onLayerSelect],
  );

  if (validLayers.length === 0 && failedLayers.length === 0) {
    return (
      <div
        className="text-sm text-gray-500 dark:text-gray-400"
        role="status"
        aria-label="No layers available"
      >
        No layers available
      </div>
    );
  }

  if (validLayers.length === 0 && failedLayers.length > 0) {
    return (
      <div
        className="text-sm text-red-500 dark:text-red-400"
        role="alert"
        aria-label="All layers failed to load"
      >
        All layers failed to load
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm min-w-48 flex items-center justify-between"
          disabled={isSelecting}
          aria-label={
            selectedLayer
              ? `Selected layer: ${selectedLayer.name}`
              : "Select a layer"
          }
          aria-haspopup="listbox"
          aria-expanded={false}
        >
          <div className="flex items-center min-w-0 flex-1">
            {isSelecting ? (
              <Loader2 className="w-4 h-4 mr-2 flex-shrink-0 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
            )}
            <span
              className="truncate overflow-hidden flex-1 min-w-0"
              title={selectedLayer?.name || "Select layer"}
            >
              {selectedLayer ? selectedLayer.name : "Select layer"}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 ml-2 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[400px] z-50 flex flex-col"
        role="listbox"
        aria-label="Layer selection menu"
      >
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 max-h-[320px]">
          {/* Valid/Selectable Layers */}
          {validLayers.map((layer, index) => {
            const layerKey = getLayerKey(layer);
            const isSelected = selectedLayerId === layerKey;

            return (
              <LayerSelectorItem
                key={layerKey}
                layer={layer}
                index={index}
                isSelected={isSelected}
                onSelect={() => handleLayerSelect(layerKey)}
                layerKey={layerKey}
              />
            );
          })}

          {/* Separator if there are failed layers */}
          {failedLayers.length > 0 && validLayers.length > 0 && (
            <DropdownMenuSeparator />
          )}

          {/* Failed/Non-selectable Layers */}
          {failedLayers.length > 0 && (
            <div role="group" aria-label="Failed layers">
              {failedLayers.map((layer, index) => (
                <FailedLayerItem
                  key={`failed-${getLayerKey(layer)}-${index}`}
                  layer={layer}
                  index={index}
                  layerKey={getLayerKey(layer)}
                />
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
