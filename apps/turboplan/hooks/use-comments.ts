"use client";

import { useCallback } from "react";

import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { CommentData } from "@wildfires-org/turboplan-utils";

const apiClient = new ApiClient();

interface UseCommentsOptions {
  projectId: string;
}

/**
 * Hook for managing comments for a project
 */
export function useComments({ projectId }: UseCommentsOptions) {
  const url = `/api/comments?projectId=${projectId}`;

  const {
    data: comments,
    error,
    isLoading,
    mutate,
  } = useSWR<CommentData[]>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 0,
  });

  /**
   * Create a new top-level comment
   */
  const createComment = useCallback(
    async (content: string) => {
      const { data, error: apiError } = await apiClient.post<CommentData>(
        "/api/comments",
        {
          projectId,
          content,
          isPublic: false,
        },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Optimistically update the cache with the new comment
      await mutate(
        (currentComments) =>
          currentComments ? [data!, ...currentComments] : [data!],
        { revalidate: true },
      );

      return data;
    },
    [projectId, mutate],
  );

  /**
   * Create a reply to an existing comment
   */
  const createReply = useCallback(
    async (parentCommentId: string, content: string) => {
      const { data, error: apiError } = await apiClient.post<CommentData>(
        "/api/comments",
        {
          projectId,
          content,
          parentCommentId,
          isPublic: false,
        },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Revalidate to get updated replies
      await mutate();

      return data;
    },
    [projectId, mutate],
  );

  /**
   * Delete a comment
   */
  const deleteComment = useCallback(
    async (commentId: string) => {
      const { error: apiError } = await apiClient.delete(
        `/api/comments/${commentId}`,
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Optimistically remove the comment from cache
      await mutate(
        (currentComments) => {
          if (!currentComments) return [];

          // Remove the comment or reply from the list
          return currentComments
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies?.filter((r) => r.id !== commentId),
            }));
        },
        { revalidate: true },
      );
    },
    [mutate],
  );

  /**
   * Toggle comment visibility (public/private)
   */
  const toggleVisibility = useCallback(
    async (commentId: string, isPublic: boolean) => {
      const { data, error: apiError } = await apiClient.patch<CommentData>(
        `/api/comments/${commentId}`,
        { isPublic },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Optimistically update the comment in cache
      await mutate(
        (currentComments) => {
          if (!currentComments) return [];

          return currentComments.map((c) => {
            if (c.id === commentId) {
              return { ...c, isPublic };
            }
            // Check replies
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId ? { ...r, isPublic } : r,
                ),
              };
            }
            return c;
          });
        },
        { revalidate: false },
      );

      return data;
    },
    [mutate],
  );

  const refreshComments = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    comments: comments ?? [],
    isLoading,
    error: error?.message ?? null,
    createComment,
    createReply,
    deleteComment,
    toggleVisibility,
    refreshComments,
  };
}
