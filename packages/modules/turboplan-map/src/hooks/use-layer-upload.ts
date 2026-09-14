"use client";

/**
 * Hook for uploading geospatial layers to the database
 */

import { useCallback, useState } from "react";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

import type { GeospatialLayer } from "../types";

export interface LayerUploadResult {
  layerId?: string;
  message: string;
  featureCount?: number;
  layers?: Array<{
    id: string;
    name: string;
    layerType: string;
    featureCount: number;
    unitIdKey?: string | null;
    unitAcresKey?: string | null;
  }>;
}

const apiClient = new ApiClient();

export interface UseLayerUploadOptions {
  onSuccess?: (result: LayerUploadResult) => void;
  onError?: (error: string) => void;
}

export function useLayerUpload(options: UseLayerUploadOptions = {}) {
  const [uploadingLayers, setUploadingLayers] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<LayerUploadResult | null>(
    null,
  );

  const uploadLayer = useCallback(
    async (
      projectLayer: GeospatialLayer | null,
      unitLayer: GeospatialLayer | null,
      layerKey: string,
      projectId: string,
      unitIdKey?: string,
    ) => {
      if (projectLayer && (!projectLayer.data || projectLayer.error)) {
        const error = "Cannot upload invalid project layer";
        setError(error);
        options.onError?.(error);
        throw new Error(error);
      }

      if (unitLayer && (unitLayer.error || !unitLayer.data)) {
        const error = "Cannot upload invalid unit layer";
        setError(error);
        options.onError?.(error);
        throw new Error(error);
      }

      if (!projectId) {
        const error = "Project ID is required";
        setError(error);
        options.onError?.(error);
        throw new Error(error);
      }

      // Clear previous error and success states
      setError(null);
      setLastSuccess(null);

      // Mark layer as uploading
      setUploadingLayers((prev) => new Set(prev).add(layerKey));

      try {
        // Prepare layer data for upload
        const layerData = {
          projectId,
          projectLayer: projectLayer
            ? {
                name: projectLayer.name,
                layerName: projectLayer.layer,
                sourceFilename: projectLayer.source,
                fileType: "geojson", // Could be made configurable
                geoData: projectLayer.data,
              }
            : null,
          unitLayer: unitLayer
            ? {
                name: unitLayer.name,
                layerName: unitLayer.layer,
                sourceFilename: unitLayer.source,
                fileType: "geojson",
                geoData: unitLayer.data,
              }
            : null,
          unitIdKey: unitIdKey || undefined,
        };

        // Use ApiClient to make authenticated request
        const { data: result, error } = await apiClient.post<LayerUploadResult>(
          "/api/maps/layers/upload",
          layerData,
        );

        if (error || !result) {
          throw new Error(error || "Upload failed");
        }

        // Success
        setLastSuccess(result);
        options.onSuccess?.(result);

        // Auto-clear success after 3 seconds
        setTimeout(() => setLastSuccess(null), 3000);

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setError(errorMessage);
        options.onError?.(errorMessage);

        // Auto-clear error after 5 seconds
        setTimeout(() => setError(null), 5000);

        throw error;
      } finally {
        // Always remove from uploading set
        setUploadingLayers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(layerKey);
          return newSet;
        });
      }
    },
    [options.onSuccess, options.onError],
  );

  const isUploading = useCallback(
    (layerKey: string) => uploadingLayers.has(layerKey),
    [uploadingLayers],
  );

  return {
    uploadLayer,
    isUploading,
    uploadingLayers,
    error,
    success: lastSuccess,
  };
}
