"use client";

import React from "react";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer, MapType } from "../types";
import { LayerSelector } from "./layer-selector";
import { SimpleMap } from "./simple-map";

interface UnitLayerSelectorProps {
  layers: GeospatialLayer[];
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string) => void;
  unitIdKey: string;
  onUnitIdKeyChange: (key: string) => void;
  availableProperties: string[];
  mapType: string;
  onMapTypeChange?: (mapType: MapType) => void;
  showMapTypeSelector?: boolean;
  showPropertySelector?: boolean;
  className?: string;
}

/**
 * Reusable component for selecting a unit layer and its ID property
 * Following Single Responsibility Principle - displays unit layer selection UI
 * Composable component that can be used in different dialog contexts
 */
export function UnitLayerSelector({
  layers,
  selectedLayerId,
  onLayerSelect,
  unitIdKey,
  onUnitIdKeyChange,
  availableProperties,
  mapType,
  onMapTypeChange,
  showMapTypeSelector = true,
  showPropertySelector = true,
  className = "h-[500px]",
}: UnitLayerSelectorProps) {
  return (
    <>
      {/* Layer Selection Dropdown */}
      {layers.length > 0 && (
        <LayerSelector
          layers={layers}
          selectedLayerId={selectedLayerId}
          onLayerSelect={onLayerSelect}
        />
      )}

      {/* Property Field Selector */}
      {showPropertySelector && availableProperties.length > 0 && (
        <div className="space-y-2 px-1">
          <Label htmlFor="unit-id-field">Field containing unit numbers</Label>
          <Select value={unitIdKey} onValueChange={onUnitIdKeyChange}>
            <SelectTrigger id="unit-id-field" className="w-full">
              <SelectValue placeholder="Select property field" />
            </SelectTrigger>
            <SelectContent>
              {availableProperties.map((prop) => (
                <SelectItem key={prop} value={prop}>
                  {prop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This field will be used to identify individual units in the layer.
          </p>
        </div>
      )}

      {/* Map Preview */}
      <div className="flex-1 min-h-[500px] rounded-lg overflow-hidden border">
        {layers.length > 0 && selectedLayerId ? (
          <SimpleMap
            layers={layers}
            selectedLayerId={selectedLayerId}
            mapType={mapType}
            onMapTypeChange={onMapTypeChange}
            showMapTypeSelector={showMapTypeSelector}
            zoomControl={true}
            className={className}
            labelPropertyKey={unitIdKey}
          />
        ) : (
          <div className="flex items-center justify-center h-[500px] text-gray-500">
            No valid layers to display
          </div>
        )}
      </div>
    </>
  );
}
