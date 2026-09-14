"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";

import {
  getProjectSeedOptions,
  type ProjectResponse,
  type ProjectSeedConfig,
} from "./project-swr-seed";

const apiClient = new ApiClient();

interface UseModuleVisibilityConfig extends ProjectSeedConfig {
  projectId: string;
  enabled?: boolean;
}

async function toggleModuleFetcher(
  url: string,
  { arg }: { arg: { moduleName: string } },
): Promise<ProjectResponse> {
  const { data, error } = await apiClient.patch<ProjectResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to toggle module visibility");
  }

  return data as ProjectResponse;
}

/**
 * Hook for managing module visibility in a project
 *
 * Provides optimistic updates for instant UI feedback when toggling module visibility.
 * Automatically rolls back on error.
 *
 * @example
 * ```tsx
 * const { hiddenModules, toggleModuleVisibility, isModuleHidden, isToggling } =
 *   useModuleVisibility({ projectId: 'abc-123' });
 *
 * // Check if map is hidden
 * const mapIsHidden = isModuleHidden('map');
 *
 * // Toggle map visibility
 * await toggleModuleVisibility('map');
 * ```
 */
export function useModuleVisibility({
  projectId,
  enabled = true,
  initialProject,
}: UseModuleVisibilityConfig) {
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

  // Mutation for toggling module visibility with optimistic updates
  const { trigger: toggleModule, isMutating: isToggling } = useSWRMutation(
    `${apiPath}/modules`,
    toggleModuleFetcher,
    {
      // Revalidate after mutation succeeds
      populateCache: true,
      revalidate: false,
      // Rollback on error
      rollbackOnError: true,
    },
  );

  /**
   * Toggle visibility of a module
   * @param moduleName - Name of the module to toggle ("map" or "tasks")
   * @throws Error if the toggle operation fails
   */
  const toggleModuleVisibility = useCallback(
    async (moduleName: string) => {
      // Validate module name
      if (!moduleName || typeof moduleName !== "string") {
        const error = new Error("Invalid module name");
        console.error("Module visibility toggle error:", error);
        throw error;
      }

      // Get current data for optimistic update
      const currentData = projectData;

      if (!currentData) {
        // No data yet, just trigger the mutation
        try {
          await toggleModule({ moduleName });
          await mutate();
        } catch (error) {
          console.error(
            `Failed to toggle module visibility for "${moduleName}":`,
            error,
          );
          throw error;
        }
        return;
      }

      const currentHiddenModules = currentData.project.hiddenModules || [];

      // Calculate optimistic update
      let updatedHiddenModules: string[];
      if (currentHiddenModules.includes(moduleName)) {
        // Remove module (show it)
        updatedHiddenModules = currentHiddenModules.filter(
          (m) => m !== moduleName,
        );
      } else {
        // Add module (hide it)
        updatedHiddenModules = [...currentHiddenModules, moduleName];
      }

      const optimisticData: ProjectResponse = {
        ...currentData,
        project: {
          ...currentData.project,
          hiddenModules: updatedHiddenModules,
        },
      };

      try {
        // Optimistically update the UI
        await mutate(
          async () => {
            // Perform the actual API call
            const result = await toggleModule({ moduleName });
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
        console.error(
          `Failed to toggle module visibility for "${moduleName}":`,
          errorMessage,
        );
        throw error;
      }
    },
    [toggleModule, mutate, projectData],
  );

  /**
   * Check if a module is currently hidden
   * @param moduleName - Name of the module to check
   * @returns true if the module is hidden, false otherwise
   */
  const isModuleHidden = useCallback(
    (moduleName: string): boolean => {
      const hiddenModules = projectData?.project.hiddenModules || [];
      return hiddenModules.includes(moduleName);
    },
    [projectData],
  );

  const hiddenModules = projectData?.project.hiddenModules || [];

  return {
    hiddenModules,
    isModuleHidden,
    toggleModuleVisibility,
    isToggling,
    isLoading,
    error,
    mutate,
  };
}
