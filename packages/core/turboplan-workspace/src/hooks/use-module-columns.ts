"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { ProjectModule } from "@wildfires-org/turboplan-db/types";

import {
  getProjectSeedOptions,
  type ProjectResponse,
  type ProjectSeedConfig,
} from "./project-swr-seed";

const apiClient = new ApiClient();

/**
 * Default column assignment for each module in the two-column project layout.
 *
 * Stored values (on `project.moduleColumns`) win over these defaults, but every
 * known module always resolves to a column so layouts stay stable for projects
 * created before column assignment existed.
 */
export const DEFAULT_MODULE_COLUMNS: Record<ProjectModule, "main" | "sidebar"> =
  {
    context: "sidebar",
    documents: "sidebar",
    timeline: "sidebar",
    map: "main",
    tasks: "main",
    fields: "main",
    comments: "main",
  };

interface UseModuleColumnsConfig extends ProjectSeedConfig {
  projectId: string;
  enabled?: boolean;
}

async function updateColumnsFetcher(
  url: string,
  { arg }: { arg: { moduleColumns: Record<string, "main" | "sidebar"> } },
): Promise<ProjectResponse> {
  const { data, error } = await apiClient.patch<ProjectResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to update module columns");
  }

  return data as ProjectResponse;
}

/**
 * Hook for managing module column assignment in a project
 *
 * Provides optimistic updates for instant UI feedback when moving modules
 * between columns. Automatically rolls back on error.
 *
 * @example
 * ```tsx
 * const { moduleColumns, updateModuleColumns, isUpdating } =
 *   useModuleColumns({ projectId: 'abc-123' });
 *
 * // Get current column assignment (stored map merged over defaults)
 * console.log(moduleColumns); // { map: "main", context: "sidebar", ... }
 *
 * // Update columns (e.g., after drag and drop across columns)
 * await updateModuleColumns({ ...moduleColumns, map: "sidebar" });
 * ```
 */
export function useModuleColumns({
  projectId,
  enabled = true,
  initialProject,
}: UseModuleColumnsConfig) {
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

  // Mutation for updating module columns with optimistic updates
  const { trigger: updateColumns, isMutating: isUpdating } = useSWRMutation(
    `${apiPath}/module-columns`,
    updateColumnsFetcher,
    {
      // Revalidate after mutation succeeds
      populateCache: true,
      revalidate: false,
      // Rollback on error
      rollbackOnError: true,
    },
  );

  // Get column assignment - merge stored map over the defaults so every known
  // module resolves to a column (stored values win).
  const storedColumns = projectData?.project.moduleColumns ?? {};
  const moduleColumns: Record<ProjectModule, "main" | "sidebar"> = {
    ...DEFAULT_MODULE_COLUMNS,
    ...storedColumns,
  };

  /**
   * Update the column assignment of modules
   * @param newColumns - Map of module name to column ("main" or "sidebar")
   * @throws Error if the update operation fails
   */
  const updateModuleColumns = useCallback(
    async (newColumns: Record<string, "main" | "sidebar">) => {
      // Validate that newColumns is a non-empty object
      if (
        typeof newColumns !== "object" ||
        newColumns === null ||
        Object.keys(newColumns).length === 0
      ) {
        const error = new Error(
          "Invalid module columns: must be a non-empty object",
        );
        console.error("Module columns update error:", error);
        throw error;
      }

      // Get current data for optimistic update
      const currentData = projectData;

      if (!currentData) {
        // No data yet, just trigger the mutation
        try {
          await updateColumns({ moduleColumns: newColumns });
          await mutate();
        } catch (error) {
          console.error("Failed to update module columns:", error);
          throw error;
        }
        return;
      }

      const optimisticData: ProjectResponse = {
        ...currentData,
        project: {
          ...currentData.project,
          moduleColumns: newColumns,
        },
      };

      try {
        // Optimistically update the UI
        await mutate(
          async () => {
            // Perform the actual API call
            const result = await updateColumns({ moduleColumns: newColumns });
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
        console.error("Failed to update module columns:", errorMessage);
        throw error;
      }
    },
    [updateColumns, mutate, projectData],
  );

  return {
    moduleColumns,
    updateModuleColumns,
    isUpdating,
    isLoading,
    error,
    mutate,
  };
}
