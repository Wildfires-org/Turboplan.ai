/**
 * Layer Visibility Selector component for toggling layer visibility
 */

"use client";

import React, { useState } from "react";

import { Layers } from "lucide-react";

import { ZINDEX } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { LAYER_COLORS } from "../types";
import { getLayerKey } from "../utils/layer-utils";

interface LayerVisibilityItem {
  id: string;
  name: string;
  visible: boolean;
  color: string;
}

interface LayerVisibilitySelectorProps {
  layers: GeospatialLayer[];
  visibleLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
  layerColors?: Record<string, string>;
}

export function LayerVisibilitySelector({
  layers,
  visibleLayerIds,
  onToggleLayer,
  layerColors = {},
}: LayerVisibilitySelectorProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Filter out layers with errors
  const validLayers = layers.filter((layer) => !layer.error && layer.data);

  // Convert layers to visibility items
  const layerItems: LayerVisibilityItem[] = validLayers.map((layer, index) => {
    const id = getLayerKey(layer);
    return {
      id,
      name: layer.name,
      visible: visibleLayerIds.has(id),
      color: layerColors[id] || LAYER_COLORS[index % LAYER_COLORS.length],
    };
  });

  if (validLayers.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        className="flex items-center justify-center w-10 h-10 bg-white shadow-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="button"
      >
        <Layers className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Hover Panel */}
      {isHovered && (
        <div
          className="absolute top-0 right-0 bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-w-[200px]"
          style={{ zIndex: ZINDEX.mapControlDropdown }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="menu"
          tabIndex={0}
        >
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
            Visible Layers
          </div>
          <div className="space-y-1">
            {layerItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onToggleLayer(item.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                type="button"
              >
                {/* Custom Checkbox */}
                <div
                  className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    item.visible
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {item.visible && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                {/* Layer color indicator */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate flex-1 text-left">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
