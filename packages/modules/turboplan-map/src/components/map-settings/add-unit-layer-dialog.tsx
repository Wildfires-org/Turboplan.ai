"use client";

import React, { useEffect } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

import { useUnitLayerSelection } from "../../hooks/use-unit-layer-selection";
import type { GeospatialLayer } from "../../types";
import { UnitLayerSelector } from "../unit-layer-selector";

interface AddUnitLayerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  validPreviewLayers: GeospatialLayer[];
  previewSelectedLayerId: string | null;
  setPreviewSelectedLayerId: (layerId: string) => void;
  mapType: string;
  isSaving: boolean;
  onSave: (unitLayerId: string, unitIdKey: string) => void;
}

/**
 * Dialog for adding a unit layer to a project
 * Focused component following Single Responsibility Principle
 */
export function AddUnitLayerDialog({
  isOpen,
  onClose,
  validPreviewLayers,
  previewSelectedLayerId,
  setPreviewSelectedLayerId,
  mapType,
  isSaving,
  onSave,
}: AddUnitLayerDialogProps) {
  // Filter to only show unit layers if available
  const displayLayers = validPreviewLayers.filter((layer) => layer.isUnitLayer);

  // If no unit layers, show all layers
  const layersToDisplay =
    displayLayers.length > 0 ? displayLayers : validPreviewLayers;

  // Use the shared hook for unit layer selection logic
  // Note: Pass null for onLayerChange since parent handles layer selection
  const {
    selectedLayerId,
    setSelectedLayerId,
    unitIdKey,
    setUnitIdKey,
    availableProperties,
  } = useUnitLayerSelection({
    layers: layersToDisplay,
    isOpen,
    onLayerChange: undefined, // Parent controls selection state
  });

  // Sync from parent (single source of truth)
  useEffect(() => {
    if (previewSelectedLayerId && previewSelectedLayerId !== selectedLayerId) {
      setSelectedLayerId(previewSelectedLayerId);
    }
  }, [previewSelectedLayerId, setSelectedLayerId]);

  // Update both local and parent state when layer changes
  const handleLayerSelect = (layerId: string) => {
    setSelectedLayerId(layerId);
    setPreviewSelectedLayerId(layerId);
  };

  const handleSave = () => {
    if (selectedLayerId && unitIdKey) {
      onSave(selectedLayerId, unitIdKey);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Unit Layer</DialogTitle>
          <DialogDescription>
            Choose the layer containing unit information and select the field
            that identifies individual units.
          </DialogDescription>
        </DialogHeader>

        <UnitLayerSelector
          layers={layersToDisplay}
          selectedLayerId={selectedLayerId}
          onLayerSelect={handleLayerSelect}
          unitIdKey={unitIdKey}
          onUnitIdKeyChange={setUnitIdKey}
          availableProperties={availableProperties}
          mapType={mapType}
          showMapTypeSelector={true}
          showPropertySelector={true}
          className="h-[500px]"
        />

        <DialogFooter className="flex !justify-between">
          <Button variant="glass" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving || !selectedLayerId || !unitIdKey}
          >
            {isSaving ? "Uploading..." : "Upload Unit Layer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
