"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import useSWR, { mutate } from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { toast } from "@wildfires-org/turboplan-utils";

import {
  getDefaultVisibleLayers,
  getLayerKey,
  useLayerUpload,
  useLayerVisibility,
  useMapFileUpload,
} from "../../client";
import { GeospatialLayer, MapType } from "../../types";
import { MapDragDropUpload } from "../map-drag-drop-upload";
import { SimpleMap } from "../simple-map";
import { AddLayerDialog } from "./add-layer-dialog";
import { MapErrorView } from "./map-error-view";
import { MapLoadingView } from "./map-loading-view";

interface MapContentManagerProps {
  projectId: string;
  className?: string;
  /** When true, hides upload/add layer functionality */
  readOnly?: boolean;
}

export function MapContentManager({
  projectId,
  className,
  readOnly = false,
}: MapContentManagerProps) {
  const [mapType, setMapType] = useState<string>("openstreetmap");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewLayers, setPreviewLayers] = useState<GeospatialLayer[]>([]);
  const [previewSelectedLayerId, setPreviewSelectedLayerId] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);

  // Use layer visibility hook for multi-layer support
  const { visibleLayerIds, toggleLayerVisibility, setVisibleLayers } =
    useLayerVisibility();

  // Identity of the layer set the default visibility was already applied for
  const defaultsAppliedKeyRef = useRef<string | null>(null);

  const {
    isUploading,
    isProcessing,
    uploadProgress,
    handleFileSelect,
    handleFileUpload: uploadFile,
  } = useMapFileUpload();

  const layersKey = `/api/maps/layers/project/${projectId}`;

  // Use the layer upload hook
  const { uploadLayer } = useLayerUpload({
    onSuccess: (result) => {
      console.log("Layer uploaded successfully:", result);
    },
    onError: (error) => {
      console.error("Layer upload failed:", error);
    },
  });

  // Fetch layers for the project
  const {
    data: layers,
    error,
    isLoading,
  } = useSWR<GeospatialLayer[]>(layersKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // Apply default visibility once per loaded layer set, so hiding the last
  // visible layer is not immediately undone on the next render
  useEffect(() => {
    if (!layers || layers.length === 0) {
      return;
    }

    const layersKeyForDefaults = layers
      .map((layer) => getLayerKey(layer))
      .join("|");
    if (defaultsAppliedKeyRef.current === layersKeyForDefaults) {
      return;
    }

    defaultsAppliedKeyRef.current = layersKeyForDefaults;
    setVisibleLayers(getDefaultVisibleLayers(layers));
  }, [layers, setVisibleLayers]);

  const handleMapTypeChange = (newMapType: MapType) => {
    setMapType(newMapType.id);
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        // Use the hook to upload and process the file
        const processedLayers = await uploadFile(file);

        // Check if there are valid layers
        const hasValidLayers = processedLayers.some(
          (layer) => !layer.error && layer.data,
        );

        if (!hasValidLayers) {
          toast({
            type: "error",
            description: "No valid layers found in the uploaded file",
          });
          return;
        }

        // Store the processed layers and open the modal
        setPreviewLayers(processedLayers);

        // Auto-select the first valid layer for preview
        const firstValidLayer = processedLayers.find(
          (layer) => !layer.error && layer.data,
        );
        if (firstValidLayer) {
          setPreviewSelectedLayerId(getLayerKey(firstValidLayer));
        }

        // Open the modal to preview
        setIsModalOpen(true);
      } catch (error) {
        const errorMessage = `Failed to process file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        toast({
          type: "error",
          description: errorMessage,
        });
      }
    },
    [uploadFile],
  );

  const handleSaveToProject = useCallback(
    async (
      projectLayerId: string,
      unitLayerId: string | null,
      unitIdKey?: string,
    ) => {
      setIsSaving(true);
      try {
        // Find the selected layers
        const projectLayer = previewLayers.find(
          (layer) => getLayerKey(layer) === projectLayerId,
        );

        if (!projectLayer || projectLayer.error || !projectLayer.data) {
          toast({
            type: "error",
            description: "Invalid project layer selected",
          });
          return;
        }

        let unitLayer: GeospatialLayer | null = null;
        if (unitLayerId) {
          const foundUnitLayer = previewLayers.find(
            (layer) => getLayerKey(layer) === unitLayerId,
          );
          if (foundUnitLayer && !foundUnitLayer.error && foundUnitLayer.data) {
            unitLayer = foundUnitLayer;
          }
        }

        // Upload the layers to the project
        const result = await uploadLayer(
          projectLayer,
          unitLayer,
          projectLayerId,
          projectId,
          unitIdKey,
        );

        const totalLayersSaved = result?.layers?.length || 0;

        toast({
          type: "success",
          description: `${totalLayersSaved} layer${totalLayersSaved > 1 ? "s" : ""} saved to project successfully`,
        });

        // Close modal and reset preview state
        setIsModalOpen(false);
        setPreviewLayers([]);
        setPreviewSelectedLayerId(null);

        // Revalidate layers to show the newly added layers
        await mutate(layersKey);
      } catch (error) {
        const errorMessage = `Failed to save layer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        toast({
          type: "error",
          description: errorMessage,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [previewLayers, projectId, layersKey, uploadLayer],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPreviewLayers([]);
    setPreviewSelectedLayerId(null);
  }, []);

  // Handle loading state
  if (isLoading) {
    return <MapLoadingView />;
  }

  // Handle error state
  if (error) {
    return <MapErrorView error={error} />;
  }

  const validPreviewLayers = previewLayers.filter((layer) => !layer.error);

  return (
    <>
      <div className={`h-full min-h-[400px] ${className || ""}`}>
        {layers && layers.length > 0 ? (
          <SimpleMap
            layers={layers}
            visibleLayerIds={visibleLayerIds}
            mapType={mapType}
            onMapTypeChange={handleMapTypeChange}
            showMapTypeSelector={true}
            showLayerSelector={true}
            onToggleLayer={toggleLayerVisibility}
            zoomControl={true}
            className="w-full h-full min-h-[400px]"
          />
        ) : readOnly ? (
          // Read-only empty state - no upload option
          <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <div className="text-4xl mb-2">🗺️</div>
              <p>No map layers available</p>
            </div>
          </div>
        ) : (
          <MapDragDropUpload
            onFileUpload={handleFileUpload}
            onFileSelect={handleFileSelect}
            isUploading={isUploading || isProcessing}
            uploadProgress={uploadProgress}
            className="w-full h-full"
          />
        )}
      </div>

      {/* Preview Modal - only shown when not readOnly */}
      {!readOnly && (
        <AddLayerDialog
          isModalOpen={isModalOpen}
          handleModalClose={handleModalClose}
          validPreviewLayers={validPreviewLayers}
          previewSelectedLayerId={previewSelectedLayerId}
          setPreviewSelectedLayerId={setPreviewSelectedLayerId}
          mapType={mapType}
          isSaving={isSaving}
          handleSaveToProject={handleSaveToProject}
        />
      )}
    </>
  );
}
