import { useEffect, useMemo, useRef, useState } from "react";

import type { GeospatialLayer } from "../types";
import { getLayerKey } from "../utils/layer-utils";

interface UseUnitLayerSelectionOptions {
  layers: GeospatialLayer[];
  isOpen: boolean;
  onLayerChange?: (layerId: string) => void;
}

interface UseUnitLayerSelectionReturn {
  selectedLayerId: string;
  setSelectedLayerId: (layerId: string) => void;
  unitIdKey: string;
  setUnitIdKey: (key: string) => void;
  selectedLayer: GeospatialLayer | null;
  availableProperties: string[];
}

const COMMON_UNIT_ID_KEYS = [
  "id",
  "ID",
  "unit",
  "Unit",
  "unit_id",
  "unitId",
  "UnitID",
  "name",
  "Name",
];

/**
 * Hook for managing unit layer selection state and logic
 *
 * This hook encapsulates the business logic for selecting and configuring unit layers,
 * including automatic initialization, property extraction, and state management.
 * Follows Single Responsibility Principle - handles only unit layer selection logic.
 *
 * Features:
 * - Automatically selects the first unit layer when modal opens
 * - Extracts available properties from selected layer (with performance optimization)
 * - Auto-detects common unit ID property names (id, unit, unit_id, etc.)
 * - Resets state when modal closes
 * - Uses ref pattern to prevent memory leaks from callback dependencies
 *
 * @param options - Configuration options
 * @param options.layers - Array of geospatial layers available for selection
 * @param options.isOpen - Whether the selection UI is currently open (controls initialization/reset)
 * @param options.onLayerChange - Optional callback invoked when layer selection changes
 *
 * @returns Object containing:
 * - selectedLayerId: ID of currently selected layer (empty string if none)
 * - setSelectedLayerId: Function to change the selected layer
 * - unitIdKey: Property key to use for identifying individual units
 * - setUnitIdKey: Function to change the unit ID key
 * - selectedLayer: Full layer object for the selected layer (null if none)
 * - availableProperties: Array of property keys available in the selected layer
 *
 * @example
 * ```tsx
 * const { selectedLayerId, unitIdKey, availableProperties } = useUnitLayerSelection({
 *   layers: geospatialLayers,
 *   isOpen: dialogOpen,
 *   onLayerChange: (id) => console.log('Layer changed:', id)
 * });
 * ```
 */
export function useUnitLayerSelection({
  layers,
  isOpen,
  onLayerChange,
}: UseUnitLayerSelectionOptions): UseUnitLayerSelectionReturn {
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [unitIdKey, setUnitIdKey] = useState<string>("");

  // Store callback in ref to prevent memory leaks from unstable callback references
  const onLayerChangeRef = useRef(onLayerChange);

  // Update ref when callback changes
  useEffect(() => {
    onLayerChangeRef.current = onLayerChange;
  }, [onLayerChange]);

  // Get the selected layer
  const selectedLayer = useMemo(() => {
    if (selectedLayerId) {
      return (
        layers.find((layer) => getLayerKey(layer) === selectedLayerId) || null
      );
    }
    return null;
  }, [selectedLayerId, layers]);

  // Extract available properties from the selected layer
  // Prefer propertiesList from database (efficient), fall back to sampling features
  const availableProperties = useMemo(() => {
    // First, try database propertiesList (already computed and stored)
    if (
      selectedLayer?.propertiesList &&
      selectedLayer.propertiesList.length > 0
    ) {
      return selectedLayer.propertiesList.sort();
    }

    // Fall back to sampling first 100 features (performance optimization)
    if (
      selectedLayer?.data?.features &&
      selectedLayer.data.features.length > 0
    ) {
      const properties = new Set<string>();
      const sampleSize = Math.min(100, selectedLayer.data.features.length);

      for (let i = 0; i < sampleSize; i++) {
        const feature = selectedLayer.data.features[i];
        if (feature.properties) {
          Object.keys(feature.properties).forEach((key) => properties.add(key));
        }
      }
      return Array.from(properties).sort();
    }
    return [];
  }, [selectedLayer]);

  // Initialize selectedLayerId when modal opens
  useEffect(() => {
    if (isOpen && !selectedLayerId && layers.length > 0) {
      const firstUnitLayer = layers.find((layer) => layer.isUnitLayer);
      if (firstUnitLayer) {
        const layerKey = getLayerKey(firstUnitLayer);
        setSelectedLayerId(layerKey);
        onLayerChangeRef.current?.(layerKey);
      } else if (layers.length > 0) {
        // If no unit layer found, use first layer
        const layerKey = getLayerKey(layers[0]);
        setSelectedLayerId(layerKey);
        onLayerChangeRef.current?.(layerKey);
      }
    }
  }, [isOpen, selectedLayerId, layers]); // Removed onLayerChange from deps (using ref)

  // Initialize unitIdKey with a common default when available properties change
  useEffect(() => {
    if (isOpen && availableProperties.length > 0) {
      // Reset unitIdKey when layer changes or if the current key is not in available properties
      if (!unitIdKey || !availableProperties.includes(unitIdKey)) {
        // Try to find a common unit ID property name
        const foundKey = COMMON_UNIT_ID_KEYS.find((key) =>
          availableProperties.includes(key),
        );
        setUnitIdKey(foundKey || availableProperties[0]);
      }
    }
  }, [isOpen, availableProperties, unitIdKey]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedLayerId("");
      setUnitIdKey("");
    }
  }, [isOpen]);

  return {
    selectedLayerId,
    setSelectedLayerId,
    unitIdKey,
    setUnitIdKey,
    selectedLayer,
    availableProperties,
  };
}
