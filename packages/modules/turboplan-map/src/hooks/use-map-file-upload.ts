"use client";

import { useCallback, useState } from "react";

import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import { toast } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer } from "../types";
import { processGeospatialFileFromUrl } from "../utils/geospatial-api-client";

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

  // Use the new upload hook with 200MB limit for large geospatial files
  const {
    upload,
    isUploading,
    reset: resetUploadState,
  } = useFileUpload({
    maxSize: 200 * 1024 * 1024, // 200MB - geospatial files can be large
    allowedTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "application/geo+json",
    ],
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
        const uploadResult = await upload(file);

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
