"use client";

import React, { useEffect, useRef, useState } from "react";

import { toast } from "@wildfires-org/turboplan-utils";

import { LayerSelector, SimpleMap } from "../components";
import { AddLayerDialog } from "../components/map-content-manager/add-layer-dialog";
import { parseMapContent } from "../components/map-content-parser";
import { MapLoader } from "../components/map-loader";
import { MAP_TYPES } from "../constants";
import { useLayerUpload } from "../hooks/use-layer-upload";
import { useMapState } from "../hooks/use-map-state";
import { useSingleLayerManagement } from "../hooks/use-single-layer-management";
import type {
  Artifact,
  GeospatialLayer,
  MapArtifactMetadata,
  MapType,
  ServerResponse,
} from "../types";
import { processGeospatialFileFromUrl } from "../utils/geospatial-api-client";
import { getLayerKey } from "../utils/layer-utils";

export const mapArtifact: Artifact<"map", MapArtifactMetadata> = {
  kind: "map",
  description: "Interactive map for displaying geospatial data",

  initialize: async ({ setMetadata }) => {
    setMetadata({
      layers: [],
      selectedLayerId: null,
      selectedMapType: MAP_TYPES.OPENSTREETMAP,
      isLoading: false,
    });
  },

  onStreamPart: ({ streamPart, setMetadata }) => {
    if (streamPart.type === "map-delta") {
      setMetadata((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  },

  content: ({ content, metadata, setMetadata, projectId }) => {
    const loadingRef = useRef(false);
    const processedContentRef = useRef<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewLayers, setPreviewLayers] = useState<GeospatialLayer[]>([]);
    const [previewSelectedLayerId, setPreviewSelectedLayerId] = useState<
      string | null
    >(null);
    const [previewMapType, setPreviewMapType] = useState<string>(
      MAP_TYPES.OPENSTREETMAP,
    );
    const [isSaving, setIsSaving] = useState(false);

    // Parse content to check status
    const parsedContent = parseMapContent(content);

    // Layer upload hook for database persistence
    const { uploadLayer } = useLayerUpload({
      onSuccess: () => {
        toast({
          type: "success",
          description: "Layers saved to project successfully",
        });
        setIsModalOpen(false);
      },
      onError: (error) => {
        toast({
          type: "error",
          description: error,
        });
      },
    });

    // Parse content and load data if needed
    useEffect(() => {
      if (!content) return;

      // Prevent processing same content multiple times
      if (processedContentRef.current === content) return;

      // Check if we already have layers
      if (metadata?.layers && metadata.layers.length > 0) return;

      // Check if already loading
      if (loadingRef.current) return;

      const parsedContent = parseMapContent(content);
      if (!parsedContent) return;

      processedContentRef.current = content;

      if (
        parsedContent.blobUrl &&
        (!metadata?.layers || metadata.layers.length === 0)
      ) {
        loadingRef.current = true;

        // Set loading state immediately
        setMetadata((prev) => ({
          ...prev,
          isLoading: true,
        }));

        processGeospatialFileFromUrl(
          parsedContent.blobUrl,
          parsedContent.fileName || "map-data.zip",
        )
          .then((layers) => {
            loadingRef.current = false;
            setMetadata((prev) => ({
              ...prev,
              layers,
              isLoading: false,
            }));

            // Auto-open modal for layer configuration if we have a projectId
            if (projectId && layers.length > 0) {
              setPreviewLayers(layers);
              setIsModalOpen(true);
            }
          })
          .catch((error) => {
            const errorMessage = `Failed to load map data: ${
              error?.message || "Unknown error"
            }`;
            toast({
              type: "error",
              description: errorMessage,
            });
            loadingRef.current = false;
            setMetadata((prev) => ({
              ...prev,
              layers: [
                {
                  name: "Error",
                  data: null,
                  error: errorMessage,
                  source: parsedContent.fileName || "blob URL",
                  layer: "error",
                },
              ],
              isLoading: false,
            }));
          });
      } else {
        // Use layers directly (legacy format)
        setMetadata((prev) => ({
          ...prev,
          layers: parsedContent.layers || [],
        }));
      }
    }, [content, metadata?.layers?.length]); // Include layers length to know when to stop

    // Get layers from metadata
    const layers: ServerResponse = metadata?.layers || [];

    // Use custom hooks for state management
    const { selectedMapType, handleMapTypeChange } = useMapState(
      metadata,
      setMetadata,
    );

    const { selectedLayerId, handleLayerSelect } = useSingleLayerManagement(
      layers,
      setMetadata,
    );

    const validLayers = layers.filter((layer) => !layer.error);
    const errorLayers = layers.filter((layer) => layer.error);

    // Modal handlers
    const handleModalClose = () => {
      setIsModalOpen(false);
      setPreviewLayers([]);
      setPreviewSelectedLayerId(null);
    };

    const handlePreviewMapTypeChange = (mapType: MapType) => {
      setPreviewMapType(typeof mapType === "string" ? mapType : mapType.id);
    };

    const handleSaveToProject = async (
      projectLayerId: string,
      unitLayerId: string | null,
      unitIdKey?: string,
    ) => {
      if (!projectId) {
        toast({
          type: "error",
          description: "No project ID available. Cannot save layers.",
        });
        return;
      }

      setIsSaving(true);

      try {
        const projectLayer = previewLayers.find(
          (l) => getLayerKey(l) === projectLayerId,
        );
        const unitLayer = unitLayerId
          ? (previewLayers.find((l) => getLayerKey(l) === unitLayerId) ?? null)
          : null;

        if (!projectLayer) {
          throw new Error("Project layer not found");
        }

        await uploadLayer(
          projectLayer,
          unitLayer,
          projectLayerId,
          projectId,
          unitIdKey,
        );
      } catch (error) {
        console.error("Error saving layers:", error);
      } finally {
        setIsSaving(false);
      }
    };

    if (metadata?.isLoading) {
      return <MapLoader message="Loading map data..." />;
    }

    return (
      <div className="w-full h-full flex flex-col space-y-4">
        {validLayers.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {parsedContent?.status === "awaiting_upload"
                  ? "Upload a Map File"
                  : "No Map Data Available"}
              </h3>
              {parsedContent?.message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                  {parsedContent.message}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Attach a ZIP file containing geospatial data in your next
                message to create a map.
              </p>
              {!projectId && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
                  Note: Map created outside a project context. Layer management
                  features will be limited.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4">
            {/* Layer info and selector */}
            {layers.length > 0 && (
              <div className="flex items-center justify-between">
                {/* Layer statistics - Left side */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {layers.length} layer{layers.length !== 1 ? "s" : ""}{" "}
                      processed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {validLayers.length} successful
                    </span>
                  </div>
                  {errorLayers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {errorLayers.length} failed
                      </span>
                    </div>
                  )}
                </div>

                {/* Layer selector dropdown - Right side */}
                <div className="relative">
                  <LayerSelector
                    layers={layers}
                    selectedLayerId={selectedLayerId}
                    onLayerSelect={handleLayerSelect}
                  />
                </div>
              </div>
            )}
            {/* Map display */}
            <div className="w-full flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden min-h-[500px]">
              {selectedLayerId ? (
                <SimpleMap
                  layers={validLayers}
                  selectedLayerId={selectedLayerId}
                  mapType={selectedMapType}
                  onMapTypeChange={handleMapTypeChange}
                  showMapTypeSelector={true}
                  zoomControl={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No layer selected
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Layer Modal - Auto-opens when layers are processed */}
        {projectId && (
          <AddLayerDialog
            isModalOpen={isModalOpen}
            handleModalClose={handleModalClose}
            validPreviewLayers={previewLayers.filter((l) => !l.error && l.data)}
            previewSelectedLayerId={previewSelectedLayerId}
            setPreviewSelectedLayerId={setPreviewSelectedLayerId}
            mapType={previewMapType}
            handlePreviewMapTypeChange={handlePreviewMapTypeChange}
            isSaving={isSaving}
            handleSaveToProject={handleSaveToProject}
          />
        )}
      </div>
    );
  },

  actions: [],
  toolbar: [],
};
