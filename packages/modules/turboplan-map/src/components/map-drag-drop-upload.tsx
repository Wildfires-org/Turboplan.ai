"use client";

import React, { useCallback, useEffect, useState } from "react";

import { AlertCircle, FileIcon, Upload } from "lucide-react";
import { type FileRejection, useDropzone } from "react-dropzone";

interface MapDragDropUploadProps {
  onFileUpload: (file: File) => void;
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  className?: string;
}

export function MapDragDropUpload({
  onFileUpload,
  onFileSelect,
  isUploading = false,
  uploadProgress = 0,
  className,
}: MapDragDropUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const maxSizeInMB = 100;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      onFileSelect(file);
      onFileUpload(file);
    },
    [onFileUpload, onFileSelect],
  );

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors.length > 0) {
        const error = rejection.errors[0];
        if (error.code === "file-too-large") {
          setError(`File size must be less than ${maxSizeInMB}MB`);
        } else if (error.code === "file-invalid-type") {
          setError("Please upload a ZIP file containing geospatial data");
        } else {
          setError(error.message);
        }
      }
    }
  }, []);

  // react-dropzone only prevents the browser default inside its own zone, so a
  // file dropped anywhere else on the page makes the browser navigate to it and
  // the app looks like it reloaded. Swallow those drops while this is mounted.
  useEffect(() => {
    const preventNavigation = (event: DragEvent) => {
      event.preventDefault();
    };

    window.addEventListener("dragover", preventNavigation);
    window.addEventListener("drop", preventNavigation);

    return () => {
      window.removeEventListener("dragover", preventNavigation);
      window.removeEventListener("drop", preventNavigation);
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
      "application/octet-stream": [".zip"],
    },
    maxSize: maxSizeInMB * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all h-[400px] flex items-center justify-center
          ${
            isDragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
          }
          ${isUploading ? "pointer-events-none opacity-60" : "cursor-pointer"}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white dark:bg-blue-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Processing Map Data...
                </p>
                {uploadProgress > 0 && (
                  <div className="w-full max-w-sm h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please wait while we process your geospatial data
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white dark:bg-gray-800">
                {isDragActive ? (
                  <FileIcon className="w-8 h-8 text-blue-500" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isDragActive ? "Drop file here" : "Upload Map Data"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drag and drop a ZIP file here, or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Supported formats: Shapefiles, GeoJSON, KML (in ZIP)
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Maximum file size: {maxSizeInMB}MB
                </p>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
