"use client";

import { useCallback } from "react";

import { toast } from "sonner";
import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";

import {
  getMemoryDeleteError,
  removeMemory,
  restoreMemory,
} from "@/lib/organization-memories";
import type {
  OrganizationMemoriesResponse,
  OrganizationMemory,
} from "@/types/organization-context";

const NO_MEMORIES: OrganizationMemory[] = [];

const apiClient = new ApiClient();

export const getOrganizationMemoriesKey = (organizationId: string) =>
  `/api/organizations/${organizationId}/memories`;

/**
 * The notes the chat assistant saved to an organization (newest first), with
 * one-click delete. Every caller for the same organization shares one SWR
 * entry, so the Context pages and the chat cards stay in step. Pass null to
 * skip fetching.
 */
export const useOrganizationMemories = (organizationId: string | null) => {
  const key = organizationId
    ? getOrganizationMemoriesKey(organizationId)
    : null;

  const { data, error, isLoading, mutate } =
    useSWR<OrganizationMemoriesResponse>(key, fetcher);

  /**
   * Removes the note at once, puts it back and shows a toast if the API
   * refuses, then refetches either way. Resolves to whether it was deleted.
   */
  const deleteMemory = useCallback(
    async (memoryId: string) => {
      let removed: OrganizationMemory | undefined;
      await mutate(
        (current) => {
          removed = current?.memories.find((memory) => memory.id === memoryId);
          return removeMemory(current, memoryId);
        },
        { revalidate: false },
      );

      try {
        const { error: apiError, status } = await apiClient.delete(
          `/api/organization-memories/${memoryId}`,
        );
        const errorMessage = apiError ? getMemoryDeleteError(status) : null;
        if (!errorMessage) {
          return true;
        }
        const memory = removed;
        if (memory) {
          await mutate((current) => restoreMemory(current, memory), {
            revalidate: false,
          });
        }
        toast.error(errorMessage);
        return false;
      } finally {
        await mutate();
      }
    },
    [mutate],
  );

  return {
    memories: data?.memories ?? NO_MEMORIES,
    isLoading,
    hasError: Boolean(error),
    deleteMemory,
  };
};
