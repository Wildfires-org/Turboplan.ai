/**
 * Layer Visibility Selector component for toggling layer visibility
 */

"use client";

import React, { useState } from "react";

import { Check, Layers } from "lucide-react";

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ZINDEX,
} from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { LAYER_COLORS } from "../types";
import { getLayerKey } from "../utils/layer-utils";
import {
  MAP_CONTROL_BUTTON_CLASS,
  MAP_CONTROL_MENU_ITEM_CLASS,
  MAP_CONTROL_MENU_LABEL_CLASS,
  MAP_CONTROL_POPOVER_PROPS,
} from "./map-type-selector";

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
  const [open, setOpen] = useState(false);

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
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Visible layers"
          className={MAP_CONTROL_BUTTON_CLASS}
        >
          <Layers aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        {...MAP_CONTROL_POPOVER_PROPS}
        className="w-56 p-1.5"
        style={{ zIndex: ZINDEX.mapControlDropdown }}
      >
        <div className={MAP_CONTROL_MENU_LABEL_CLASS}>Visible Layers</div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {layerItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.visible}
              onClick={() => onToggleLayer(item.id)}
              className={MAP_CONTROL_MENU_ITEM_CLASS}
            >
              {/* Checkbox */}
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  item.visible
                    ? "border-brand-800 bg-brand-800"
                    : "border-gray-300 dark:border-gray-600",
                )}
              >
                {item.visible && (
                  <Check
                    aria-hidden
                    className="size-3 text-white"
                    strokeWidth={3}
                  />
                )}
              </span>
              {/* Layer color indicator (data color) */}
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 truncate">{item.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
