"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";

import type { ContextEntryWithCreator } from "../types";

export type { ContextEntryWithCreator };

const apiClient = new ApiClient();

interface UseProjectContextConfig {
  projectId: string;
  enabled?: boolean;
}

interface ContextListResponse {
  context: ContextEntryWithCreator[];
}

interface ContextEntryResponse {
  contextEntry: ContextEntryWithCreator;
}

export interface CreateContextInput {
  label: string;
  content: string;
  url?: string;
}

export interface UpdateContextInput {
  contextId: string;
  label?: string;
  content?: string;
  url?: string | null;
}

async function createContextFetcher(
  url: string,
  { arg }: { arg: CreateContextInput },
): Promise<ContextEntryResponse> {
  const { data, error } = await apiClient.post<ContextEntryResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to create context entry");
  }

  return data as ContextEntryResponse;
}

async function deleteContextFetcher(
  url: string,
  { arg }: { arg: { contextId: string } },
): Promise<{ success: boolean }> {
  const { data, error } = await apiClient.delete<{ success: boolean }>(
    `${url}/${arg.contextId}`,
  );

  if (error) {
    throw new Error(error || "Failed to delete context entry");
  }

  return data as { success: boolean };
}

async function updateContextFetcher(
  url: string,
  { arg }: { arg: UpdateContextInput },
): Promise<ContextEntryResponse> {
  const { contextId, ...body } = arg;
  const { data, error } = await apiClient.patch<ContextEntryResponse>(
    `${url}/${contextId}`,
    body,
  );

  if (error) {
    throw new Error(error || "Failed to update context entry");
  }

  return data as ContextEntryResponse;
}

/**
 * Hook for managing project context entries
 *
 * Provides create/delete operations and optimistic updates for project context.
 *
 * @example
 * ```tsx
 * const { entries, addEntry, deleteEntry, isLoading } =
 *   useProjectContext({ projectId: 'abc-123' });
 *
 * // Add a new context entry
 * await addEntry({ label: 'Budget', content: '$500k' });
 *
 * // Delete a context entry
 * await deleteEntry('entry-id');
 * ```
 */
export function useProjectContext({
  projectId,
  enabled = true,
}: UseProjectContextConfig) {
  const apiPath = `/api/projects/${projectId}/context`;

  // Fetch project context entries
  const {
    data: contextData,
    isLoading,
    error,
    mutate,
  } = useSWR<ContextListResponse>(enabled ? apiPath : null, fetcher);

  // Mutations
  const { trigger: triggerCreate, isMutating: isCreating } = useSWRMutation(
    apiPath,
    createContextFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const { trigger: triggerDelete, isMutating: isDeleting } = useSWRMutation(
    apiPath,
    deleteContextFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const { trigger: triggerUpdate, isMutating: isUpdating } = useSWRMutation(
    apiPath,
    updateContextFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const entries = contextData?.context || [];

  /**
   * Add a new context entry to the project
   */
  const addEntry = useCallback(
    async (input: CreateContextInput) => {
      const currentEntries = entries;

      // Optimistic update
      const now = new Date();
      const optimisticEntry: ContextEntryWithCreator = {
        id: crypto.randomUUID(),
        projectId,
        label: input.label,
        content: input.content,
        url: input.url ?? null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        creatorFirstName: null,
        creatorLastName: null,
        creatorAvatarUrl: null,
      };

      try {
        await mutate(
          async () => {
            const result = await triggerCreate(input);
            return { context: [...currentEntries, result.contextEntry] };
          },
          {
            optimisticData: {
              context: [...currentEntries, optimisticEntry],
            },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to add context entry:", error);
        throw error;
      }
    },
    [entries, projectId, triggerCreate, mutate],
  );

  /**
   * Delete a context entry
   */
  const deleteEntry = useCallback(
    async (contextId: string) => {
      const currentEntries = entries;

      // Optimistic update - remove entry
      const optimisticEntries = currentEntries.filter(
        (e) => e.id !== contextId,
      );

      try {
        await mutate(
          async () => {
            await triggerDelete({ contextId });
            return { context: optimisticEntries };
          },
          {
            optimisticData: { context: optimisticEntries },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to delete context entry:", error);
        throw error;
      }
    },
    [entries, triggerDelete, mutate],
  );

  /**
   * Update an existing context entry
   */
  const updateEntry = useCallback(
    async (input: UpdateContextInput) => {
      const currentEntries = entries;
      const { contextId, ...updates } = input;

      // Optimistic update
      const optimisticEntries = currentEntries.map((e) =>
        e.id === contextId
          ? {
              ...e,
              ...(updates.label !== undefined && { label: updates.label }),
              ...(updates.content !== undefined && {
                content: updates.content,
              }),
              ...(updates.url !== undefined && { url: updates.url }),
              updatedAt: new Date(),
            }
          : e,
      );

      try {
        await mutate(
          async () => {
            const result = await triggerUpdate(input);
            return {
              context: currentEntries.map((e) =>
                e.id === contextId ? result.contextEntry : e,
              ),
            };
          },
          {
            optimisticData: { context: optimisticEntries },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to update context entry:", error);
        throw error;
      }
    },
    [entries, triggerUpdate, mutate],
  );

  return {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isMutating: isCreating || isUpdating || isDeleting,
    error,
    mutate,
  };
}
