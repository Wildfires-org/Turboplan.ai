"use client";

import { useCallback, useState } from "react";

import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  GIS_MAX_FILE_SIZE,
  GIS_UPLOAD_CONTENT_TYPES,
  resolveProjectFileContentType,
} from "@wildfires-org/turboplan-upload/types";
import { toast } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { processGeospatialFileFromUrl } from "../utils/geospatial-api-client";
import { hasMapFeatures } from "../utils/layer-utils";

// Browsers often report no type (or a generic one) for GIS files, and the
// upload allow list refuses those: re-wrap with the type the extension maps to.
const withResolvedContentType = (file: File): File => {
  const contentType = resolveProjectFileContentType(file);
  if (!contentType || contentType === file.type) {
    return file;
  }
  return new File([file], file.name, {
    type: contentType,
    lastModified: file.lastModified,
  });
};

// The map service drops layers with nothing to draw, so a file can come back
// with no layers at all, or with only the reasons its layers were rejected.
const getNoFeaturesMessage = (
  fileName: string,
  layers: GeospatialLayer[],
): string => {
  const reasons = layers
    .map((layer) => layer.error)
    .filter((reason): reason is string => Boolean(reason));
  return reasons.length > 0
    ? reasons.join(" ")
    : `No map features found in "${fileName}"`;
};

interface UseMapFileUploadResult {
  isUploading: boolean;
  isProcessing: boolean;
  uploadProgress: number;
  selectedFile: File | null;
  handleFileSelect: (file: File) => void;
  handleFileUpload: (file: File) => Promise<GeospatialLayer[]>;
  resetUpload: () => void;
}

export function useMapFileUpload(): UseMapFileUploadResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // The map service refuses downloads over GIS_MAX_FILE_SIZE, so cap there.
  const {
    upload,
    isUploading,
    reset: resetUploadState,
  } = useFileUpload({
    maxSize: GIS_MAX_FILE_SIZE,
    // Plain JSON stays accepted: the map service detects GeoJSON by content.
    allowedTypes: [...GIS_UPLOAD_CONTENT_TYPES, "application/json"],
    onProgress: (percent) => {
      // Map upload progress to 0-60% range (60% allocated for upload)
      setUploadProgress(Math.round(percent * 0.6));
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File): Promise<GeospatialLayer[]> => {
      setUploadProgress(0);

      try {
        // Upload to blob storage (0-60% progress)
        const uploadResult = await upload(withResolvedContentType(file));

        // Process the uploaded file (60-90% progress)
        setUploadProgress(60);
        setIsProcessing(true);

        const processedLayers = await processGeospatialFileFromUrl(
          uploadResult.url,
          file.name,
        );

        setUploadProgress(90);

        // Complete
        setUploadProgress(100);

        // Callers stop at a file without features; this is its only message.
        if (!processedLayers.some(hasMapFeatures)) {
          toast({
            type: "error",
            description: getNoFeaturesMessage(file.name, processedLayers),
          });
          return processedLayers;
        }

        toast({
          type: "success",
          description: `File "${file.name}" processed successfully`,
        });

        return processedLayers;
      } catch (error) {
        const errorMessage = `Failed to process file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        toast({
          type: "error",
          description: errorMessage,
        });

        // Return error layer
        return [
          {
            name: "Error",
            data: null,
            error: errorMessage,
            source: file.name,
            layer: "error",
          },
        ];
      } finally {
        setIsProcessing(false);
        setUploadProgress(0);
      }
    },
    [upload],
  );

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsProcessing(false);
    resetUploadState();
  }, [resetUploadState]);

  return {
    isUploading,
    isProcessing,
    uploadProgress,
    selectedFile,
    handleFileSelect,
    handleFileUpload,
    resetUpload,
  };
}
