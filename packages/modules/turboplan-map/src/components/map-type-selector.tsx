/**
 * Map Type Selector component for switching between different map layers
 */

"use client";

import React, { useState } from "react";

import { Globe, Mountain, Satellite } from "lucide-react";

import { ZINDEX } from "@wildfires-org/turboplan-utils";

import type { MapType } from "../types";

export const MAP_TYPES: MapType[] = [
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    icon: Globe,
  },
  {
    id: "satellite",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '© <a href="https://www.esri.com/">Esri</a>, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
    maxZoom: 17,
    icon: Satellite,
  },
  {
    id: "terrain",
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    icon: Mountain,
  },
];

interface MapTypeSelectorProps {
  selectedMapType: string;
  onMapTypeChange: (mapType: MapType) => void;
}

export function MapTypeSelector({
  selectedMapType,
  onMapTypeChange,
}: MapTypeSelectorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const currentMapType =
    MAP_TYPES.find((type) => type.id === selectedMapType) || MAP_TYPES[0];
  const CurrentIcon = currentMapType.icon;

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        className="flex items-center justify-center w-10 h-10 bg-white shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="button"
      >
        <CurrentIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Hover Tooltip */}
      {isHovered && (
        <div
          className="absolute top-0 right-0 bg-white shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-w-[140px]"
          style={{ zIndex: ZINDEX.mapControlDropdown }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="button"
          tabIndex={0}
        >
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
            Map Type
          </div>
          <div className="space-y-1">
            {MAP_TYPES.map((mapType) => {
              const Icon = mapType.icon;
              const isSelected = selectedMapType === mapType.id;

              return (
                <button
                  key={mapType.id}
                  onClick={() => {
                    onMapTypeChange(mapType);
                    setIsHovered(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                  type="button"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{mapType.name}</span>
                  {isSelected && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
