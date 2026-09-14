"use client";

import { useCallback, useMemo } from "react";

import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import { toast } from "@wildfires-org/turboplan-utils";

import type { GeospatialLayer, ProjectLayersSummary } from "../types";
import { analyzeLayerStatus } from "../utils/layer-status";

interface UseLayerStatusResult {
  status: ProjectLayersSummary | null;
  isLoading: boolean;
  error: Error | null;
  layers: GeospatialLayer[];
  deleteLayer: (layerId: string, layerType: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const apiClient = new ApiClient();

/**
 * Hook for managing layer status for a project
 * Fetches layers, analyzes their status, and provides delete functionality
 *
 * Following Dependency Inversion Principle - depends on abstractions (API client)
 * @param projectId The project ID to fetch layers for
 * @returns Layer status information and handlers
 */
export function useLayerStatus(projectId: string): UseLayerStatusResult {
  // Fetch layers for the project
  const {
    data: layers,
    error,
    isLoading,
    mutate: mutateLayers,
  } = useSWR<GeospatialLayer[]>(
    `/api/maps/layers/project/${projectId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Analyze layer status
  const status = useMemo(() => {
    if (!layers) return null;
    return analyzeLayerStatus(layers);
  }, [layers]);

  // Delete individual layer handler
  const deleteLayer = useCallback(
    async (layerId: string, layerType: string) => {
      try {
        const result = await apiClient.delete<{ success: boolean }>(
          `/api/maps/layers/${layerId}`,
        );

        if (result.error) {
          toast({
            type: "error",
            description: "Failed to delete layer. Please try again.",
          });
          throw new Error(result.error);
        }

        if (result.data?.success) {
          // Revalidate the layers cache to refresh
          await mutateLayers();
          toast({
            type: "success",
            description: `${layerType} layer deleted successfully`,
          });
        }
      } catch (error) {
        console.error("Error deleting layer:", error);
        toast({
          type: "error",
          description: "Failed to delete layer. Please try again.",
        });
        throw error;
      }
    },
    [mutateLayers],
  );

  // Refresh layers
  const refresh = useCallback(async () => {
    await mutateLayers();
  }, [mutateLayers]);

  return {
    status,
    isLoading,
    error: error || null,
    layers: layers || [],
    deleteLayer,
    refresh,
  };
}
