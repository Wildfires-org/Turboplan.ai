"use client";

import React from "react";

import { CheckCircle } from "lucide-react";

import { DropdownMenuItem } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { LAYER_COLORS } from "../types";

interface LayerSelectorItemProps {
  layer: GeospatialLayer;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  layerKey: string;
}

export function LayerSelectorItem({
  layer,
  index,
  isSelected,
  onSelect,
  layerKey,
}: LayerSelectorItemProps) {
  return (
    <div key={layerKey} className="group">
      <DropdownMenuItem
        onClick={onSelect}
        className={`flex items-center gap-3 p-3 cursor-pointer pr-12 relative ${
          isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
        role="option"
        aria-selected={isSelected}
        aria-label={`Layer: ${layer.name}, ${
          layer.data?.features?.length ?? 0
        } features`}
      >
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{
            backgroundColor: LAYER_COLORS[index % LAYER_COLORS.length],
          }}
          aria-label={`Layer color indicator`}
          role="img"
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
            title={layer.name}
          >
            {layer.name}
            {isSelected && (
              <CheckCircle
                className="inline w-3 h-3 ml-1 text-blue-600"
                aria-label="Selected"
              />
            )}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate" title={layer.source}>
              {layer.source}
            </span>
            <span aria-hidden="true">•</span>
            <span>{layer.data?.features?.length ?? 0} features</span>
          </div>
        </div>
      </DropdownMenuItem>
    </div>
  );
}
