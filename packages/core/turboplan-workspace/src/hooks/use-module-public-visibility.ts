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

interface UseModulePublicVisibilityConfig extends ProjectSeedConfig {
  projectId: string;
  enabled?: boolean;
}

async function toggleModulePublicFetcher(
  url: string,
  { arg }: { arg: { moduleName: string } },
): Promise<ProjectResponse> {
  const { data, error } = await apiClient.patch<ProjectResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to toggle module public visibility");
  }

  return data as ProjectResponse;
}

/**
 * Hook for managing module public visibility in a project
 *
 * Controls which modules are visible to public/non-logged-in users on the catalog.
 * Provides optimistic updates for instant UI feedback when toggling module public visibility.
 * Automatically rolls back on error.
 *
 * @example
 * ```tsx
 * const { privateModules, toggleModulePublicVisibility, isModulePrivate, isToggling } =
 *   useModulePublicVisibility({ projectId: 'abc-123' });
 *
 * // Check if map is private (hidden from public)
 * const mapIsPrivate = isModulePrivate('map');
 *
 * // Toggle map public visibility
 * await toggleModulePublicVisibility('map');
 * ```
 */
export function useModulePublicVisibility({
  projectId,
  enabled = true,
  initialProject,
}: UseModulePublicVisibilityConfig) {
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

  // Mutation for toggling module public visibility with optimistic updates
  const { trigger: toggleModule, isMutating: isToggling } = useSWRMutation(
    `${apiPath}/modules/public`,
    toggleModulePublicFetcher,
    {
      // Revalidate after mutation succeeds
      populateCache: true,
      revalidate: false,
      // Rollback on error
      rollbackOnError: true,
    },
  );

  /**
   * Toggle public visibility of a module
   * @param moduleName - Name of the module to toggle ("map", "tasks", or "documents")
   * @throws Error if the toggle operation fails
   */
  const toggleModulePublicVisibility = useCallback(
    async (moduleName: string) => {
      // Validate module name
      if (!moduleName || typeof moduleName !== "string") {
        const error = new Error("Invalid module name");
        console.error("Module public visibility toggle error:", error);
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
            `Failed to toggle module public visibility for "${moduleName}":`,
            error,
          );
          throw error;
        }
        return;
      }

      const currentPrivateModules = currentData.project.privateModules || [];

      // Calculate optimistic update
      let updatedPrivateModules: string[];
      if (currentPrivateModules.includes(moduleName)) {
        // Remove module (make it public)
        updatedPrivateModules = currentPrivateModules.filter(
          (m) => m !== moduleName,
        );
      } else {
        // Add module (make it private)
        updatedPrivateModules = [...currentPrivateModules, moduleName];
      }

      const optimisticData: ProjectResponse = {
        ...currentData,
        project: {
          ...currentData.project,
          privateModules: updatedPrivateModules,
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
          `Failed to toggle module public visibility for "${moduleName}":`,
          errorMessage,
        );
        throw error;
      }
    },
    [toggleModule, mutate, projectData],
  );

  /**
   * Check if a module is currently private (hidden from public/catalog)
   * @param moduleName - Name of the module to check
   * @returns true if the module is private, false otherwise
   */
  const isModulePrivate = useCallback(
    (moduleName: string): boolean => {
      const privateModules = projectData?.project.privateModules || [];
      return privateModules.includes(moduleName);
    },
    [projectData],
  );

  const privateModules = projectData?.project.privateModules || [];

  return {
    privateModules,
    isModulePrivate,
    toggleModulePublicVisibility,
    isToggling,
    isLoading,
    error,
    mutate,
  };
}
