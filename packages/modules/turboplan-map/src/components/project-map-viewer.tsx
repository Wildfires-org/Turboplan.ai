"use client";

import React from "react";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { Button } from "@wildfires-org/turboplan-utils";

import { getDefaultVisibleLayers, getLayerKey } from "../client";
import { useLayerVisibility } from "../hooks/use-layer-visibility";
import { useMapLayers } from "../hooks/use-map-layers";
import { useMapType } from "../hooks/use-map-type";
import type { GeospatialLayer } from "../types";
import { SimpleMap } from "./simple-map";

interface ProjectMapViewerProps {
  className?: string;
  projectId: string;
  organizationId: string;
  officeId: string;
}

export function ProjectMapViewer({
  className,
  projectId,
  organizationId,
  officeId,
}: ProjectMapViewerProps) {
  const layersKey = `/api/maps/layers/project/${projectId}`;

  // Fetch layers for the project
  const {
    data: fetchedLayers,
    error,
    isLoading,
  } = useSWR<GeospatialLayer[]>(layersKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { layers, setLayers, validLayers } = useMapLayers();

  // Use layer visibility hook for multi-layer support
  const { visibleLayerIds, toggleLayerVisibility, setVisibleLayers } =
    useLayerVisibility();

  // Identity of the layer set the default visibility was already applied for
  const defaultsAppliedKeyRef = React.useRef<string | null>(null);

  // Update local state when data is fetched, and apply default visibility once
  // per loaded layer set so hiding the last visible layer is not undone
  React.useEffect(() => {
    if (!fetchedLayers || fetchedLayers.length === 0) {
      return;
    }

    setLayers(fetchedLayers);

    const layersKeyForDefaults = fetchedLayers
      .map((layer) => getLayerKey(layer))
      .join("|");
    if (defaultsAppliedKeyRef.current === layersKeyForDefaults) {
      return;
    }

    defaultsAppliedKeyRef.current = layersKeyForDefaults;
    setVisibleLayers(getDefaultVisibleLayers(fetchedLayers));
  }, [fetchedLayers, setLayers, setVisibleLayers]);

  const { selectedMapType, handleMapTypeChange } = useMapType("openstreetmap");

  // Handle loading state
  if (isLoading) {
    return (
      <div className={`${className || "w-full h-full"}`}>
        <div
          role="status"
          aria-label="Loading map"
          className="size-full bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none dark:bg-slate-800/70"
        />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={`${className || "w-full h-full"}`}>
        <div className="flex items-center justify-center h-full bg-red-50 dark:bg-gray-900 rounded-lg">
          <div className="text-center space-y-4">
            <div className="size-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg
                className="size-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Error Loading Map Data
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {error.message || "Failed to fetch map layers"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className || "w-full h-full"}`}>
      {layers.length === 0 ? (
        <>
          <div className="flex justify-end absolute top-20 left-4 z-20 gap-4">
            <Button variant="outline">
              <Link href={`/${organizationId}/${officeId}/${projectId}`}>
                <div className="flex items-center gap-2">
                  <ArrowLeftIcon /> Back to project
                </div>
              </Link>
            </Button>
          </div>
          <SimpleMap grayscale={true} className="w-full h-full" />
          {/* Skip for now - uncomment if needed
           <div className="flex flex-col p-8 bg-white max-w-md rounded-lg justify-end absolute bottom-20 left-4 z-20 gap-4">
            <h1 className="text-2xl font-bold">Define project boundaries</h1>
            <p>
              Upload your custom map to define project boundaries and locations.
            </p>
            <Button>Upload project map</Button>
          </div> */}
        </>
      ) : (
        <div className="flex flex-col h-full space-y-4">
          {/* Map display */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {validLayers.length > 0 ? (
              <SimpleMap
                layers={validLayers}
                visibleLayerIds={visibleLayerIds}
                mapType={
                  typeof selectedMapType === "string"
                    ? selectedMapType
                    : selectedMapType.id
                }
                onMapTypeChange={handleMapTypeChange}
                showMapTypeSelector={true}
                showLayerSelector={true}
                onToggleLayer={toggleLayerVisibility}
                zoomControl={true}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No valid layers available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
