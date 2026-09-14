"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import { PROJECT_MODULES } from "@wildfires-org/turboplan-db/types";

import {
  getProjectSeedOptions,
  type ProjectResponse,
  type ProjectSeedConfig,
} from "./project-swr-seed";

const apiClient = new ApiClient();

interface UseModuleOrderConfig extends ProjectSeedConfig {
  projectId: string;
  enabled?: boolean;
}

async function updateOrderFetcher(
  url: string,
  { arg }: { arg: { moduleOrder: string[] } },
): Promise<ProjectResponse> {
  const { data, error } = await apiClient.patch<ProjectResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to update module order");
  }

  return data as ProjectResponse;
}

/**
 * Hook for managing module order in a project
 *
 * Provides optimistic updates for instant UI feedback when reordering modules.
 * Automatically rolls back on error.
 *
 * @example
 * ```tsx
 * const { moduleOrder, updateModuleOrder, isUpdating } =
 *   useModuleOrder({ projectId: 'abc-123' });
 *
 * // Get current order
 * console.log(moduleOrder); // ["map", "tasks"]
 *
 * // Update order (e.g., after drag and drop)
 * await updateModuleOrder(["tasks", "map"]);
 * ```
 */
export function useModuleOrder({
  projectId,
  enabled = true,
  initialProject,
}: UseModuleOrderConfig) {
  const apiPath = `/api/projects/${projectId}`;

  // Fetch project data
  const {
    data: projectData,
    isLoading,
    error,
    mutate,
  } = useSWR<ProjectResponse>(
    enabled ? apiPath : null,
    fetcher,
    getProjectSeedOptions(projectId, initialProject),
  );

  // Mutation for updating module order with optimistic updates
  const { trigger: updateOrder, isMutating: isUpdating } = useSWRMutation(
    `${apiPath}/module-order`,
    updateOrderFetcher,
    {
      // Revalidate after mutation succeeds
      populateCache: true,
      revalidate: false,
      // Rollback on error
      rollbackOnError: true,
    },
  );

  // Get ordered modules - merge stored order with any new modules from PROJECT_MODULES
  const storedOrder = projectData?.project.moduleOrder || [];
  const moduleOrder =
    storedOrder.length > 0
      ? [
          // Keep stored order
          ...storedOrder,
          // Append any new modules not in stored order
          ...PROJECT_MODULES.filter((m) => !storedOrder.includes(m)),
        ]
      : [...PROJECT_MODULES];

  /**
   * Update the order of modules
   * @param newOrder - Array of module names in the desired order
   * @throws Error if the update operation fails
   */
  const updateModuleOrder = useCallback(
    async (newOrder: string[]) => {
      // Validate that newOrder is a non-empty array
      if (!Array.isArray(newOrder) || newOrder.length === 0) {
        const error = new Error(
          "Invalid module order: must be a non-empty array",
        );
        console.error("Module order update error:", error);
        throw error;
      }

      // Get current data for optimistic update
      const currentData = projectData;

      if (!currentData) {
        // No data yet, just trigger the mutation
        try {
          await updateOrder({ moduleOrder: newOrder });
          await mutate();
        } catch (error) {
          console.error("Failed to update module order:", error);
          throw error;
        }
        return;
      }

      const optimisticData: ProjectResponse = {
        ...currentData,
        project: {
          ...currentData.project,
          moduleOrder: newOrder,
        },
      };

      try {
        // Optimistically update the UI
        await mutate(
          async () => {
            // Perform the actual API call
            const result = await updateOrder({ moduleOrder: newOrder });
            return result;
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to update module order:", errorMessage);
        throw error;
      }
    },
    [updateOrder, mutate, projectData],
  );

  return {
    moduleOrder,
    updateModuleOrder,
    isUpdating,
    isLoading,
    error,
    mutate,
  };
}
