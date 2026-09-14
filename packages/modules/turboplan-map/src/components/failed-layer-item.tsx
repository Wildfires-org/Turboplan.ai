"use client";

import React from "react";

import { AlertTriangle } from "lucide-react";

import type { GeospatialLayer } from "../types";

interface FailedLayerItemProps {
  layer: GeospatialLayer;
  index: number;
  layerKey: string;
}

export function FailedLayerItem({
  layer,
  index,
  layerKey,
}: FailedLayerItemProps) {
  return (
    <div
      key={`failed-${layerKey}-${index}`}
      className="flex items-center gap-3 p-3 opacity-60 cursor-not-allowed"
      role="alert"
      aria-label={`Failed layer: ${layer.name}, Error: ${layer.error}`}
    >
      <div
        className="w-4 h-4 rounded-full flex-shrink-0 bg-red-400 flex items-center justify-center"
        aria-label="Error indicator"
        role="img"
      >
        <AlertTriangle className="w-3 h-3 text-white" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"
          title={layer.name}
        >
          {layer.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
          <span className="truncate" title={layer.source}>
            {layer.source}
          </span>
          <span aria-hidden="true">•</span>
          <span className="truncate" title={`Failed: ${layer.error}`}>
            Failed: {layer.error}
          </span>
        </div>
      </div>
    </div>
  );
}
