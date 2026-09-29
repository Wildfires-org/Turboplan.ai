import React from "react";

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
import { GeospatialLayer, MapType } from "../../types";
import { LayerSelector } from "../layer-selector";
import { SimpleMap } from "../simple-map";
import { UnitLayerSelector } from "../unit-layer-selector";

interface AddLayerDialogProps {
  isModalOpen: boolean;
  handleModalClose: () => void;
  validPreviewLayers: GeospatialLayer[];
  previewSelectedLayerId: string | null;
  setPreviewSelectedLayerId: (layerId: string) => void;
  mapType: string;
  handlePreviewMapTypeChange?: (mapType: MapType) => void;
  isSaving: boolean;
  handleSaveToProject: (
    projectLayerId: string,
    unitLayerId: string | null,
    unitIdKey?: string,
  ) => void;
}

export function AddLayerDialog({
  isModalOpen,
  handleModalClose,
  validPreviewLayers,
  previewSelectedLayerId,
  setPreviewSelectedLayerId,
  mapType,
  handlePreviewMapTypeChange,
  isSaving,
  handleSaveToProject,
}: AddLayerDialogProps) {
  const hasUnitLayer = validPreviewLayers.some((layer) => layer.isUnitLayer);
  const [step, setStep] = React.useState(1);
  const [projectLayerId, setProjectLayerId] = React.useState<string>("");

  // Get unit layers for step 2
  const unitLayers = React.useMemo(
    () => validPreviewLayers.filter((layer) => layer.isUnitLayer),
    [validPreviewLayers],
  );

  // Use the shared hook for unit layer selection (step 2)
  const {
    selectedLayerId: unitLayerId,
    setSelectedLayerId: setUnitLayerId,
    unitIdKey,
    setUnitIdKey,
    availableProperties,
  } = useUnitLayerSelection({
    layers: unitLayers,
    isOpen: isModalOpen && step === 2,
    onLayerChange: setPreviewSelectedLayerId,
  });

  // Initialize projectLayerId when modal opens or layers change
  React.useEffect(() => {
    if (isModalOpen && previewSelectedLayerId && !projectLayerId) {
      setProjectLayerId(previewSelectedLayerId);
    }
  }, [isModalOpen, previewSelectedLayerId, projectLayerId]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isModalOpen) {
      setStep(1);
      setProjectLayerId("");
    }
  }, [isModalOpen]);

  const handleStepChange = (newStep: number) => {
    if (newStep === 1) {
      setStep(1);
      setPreviewSelectedLayerId(projectLayerId);
    } else if (newStep === 2) {
      // Save current selection as project layer before moving to step 2
      if (previewSelectedLayerId) {
        setProjectLayerId(previewSelectedLayerId);
      }
      setStep(2);
    }
  };

  const handleLayerSelect = (layerId: string) => {
    setPreviewSelectedLayerId(layerId);
    if (step === 1) {
      setProjectLayerId(layerId);
    } else {
      setUnitLayerId(layerId);
    }
  };

  // Get layers to display based on current step
  const displayLayers = step === 2 ? unitLayers : validPreviewLayers;

  return (
    <Dialog open={isModalOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          {hasUnitLayer && (
            <p className="text-sm text-muted-foreground">Step {step} of 2</p>
          )}
          <DialogTitle>
            {step === 1 ? "Select Project Boundary Layer" : "Select Unit Layer"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Choose the layer to use as your project boundary."
              : "Choose the layer containing unit information (optional)."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <LayerSelector
              layers={displayLayers}
              selectedLayerId={previewSelectedLayerId}
              onLayerSelect={handleLayerSelect}
            />
            <div className="flex-1 min-h-[500px] rounded-lg overflow-hidden border">
              {displayLayers.length > 0 && previewSelectedLayerId ? (
                <SimpleMap
                  layers={displayLayers}
                  selectedLayerId={previewSelectedLayerId}
                  mapType={mapType}
                  onMapTypeChange={handlePreviewMapTypeChange}
                  showMapTypeSelector={true}
                  zoomControl={true}
                  className="h-[500px]"
                />
              ) : (
                <div className="flex items-center justify-center h-[500px] text-gray-500">
                  No valid layers to display
                </div>
              )}
            </div>
          </>
        ) : (
          <UnitLayerSelector
            layers={displayLayers}
            selectedLayerId={previewSelectedLayerId}
            onLayerSelect={handleLayerSelect}
            unitIdKey={unitIdKey}
            onUnitIdKeyChange={setUnitIdKey}
            availableProperties={availableProperties}
            mapType={mapType}
            onMapTypeChange={handlePreviewMapTypeChange}
            showMapTypeSelector={true}
            showPropertySelector={true}
            className="h-[500px]"
          />
        )}

        {hasUnitLayer ? (
          <DialogFooter className="flex !justify-between">
            <Button
              variant="glass"
              onClick={handleModalClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              {step === 1 && (
                <>
                  <Button
                    variant="glass"
                    onClick={() =>
                      handleSaveToProject(projectLayerId, null, undefined)
                    }
                    disabled={isSaving || !projectLayerId}
                  >
                    {isSaving ? "Uploading..." : "Upload without Units"}
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() => handleStepChange(2)}
                    disabled={!projectLayerId}
                  >
                    Next
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Button variant="glass" onClick={() => handleStepChange(1)}>
                    Back
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() =>
                      handleSaveToProject(
                        projectLayerId,
                        unitLayerId,
                        unitIdKey,
                      )
                    }
                    disabled={
                      isSaving || !projectLayerId || !unitLayerId || !unitIdKey
                    }
                  >
                    {isSaving ? "Uploading..." : "Confirm & Upload"}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex !justify-between">
            <Button
              variant="glass"
              onClick={handleModalClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() =>
                handleSaveToProject(projectLayerId, null, undefined)
              }
              disabled={isSaving || !projectLayerId}
            >
              {isSaving ? "Uploading..." : "Save to Project"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
