"use client";

import { useCallback, useEffect, useState } from "react";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

// Constants for polling behavior
const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds
const POLLING_TIMEOUT_MS = 60000; // Stop polling after 60 seconds

interface GeneratedImage {
  id: string;
  imageUrl: string;
  entityId: string;
  entityType: string;
  prompt: string;
  createdAt: string;
}

interface ProjectWithRelations {
  project: Project;
  office: unknown;
  creator: unknown;
}

interface UseCoverImageOptions {
  projectId: string;
  initialCoverImageId?: string | null;
  initialCoverImageUrl?: string | null;
}

interface UseCoverImageReturn {
  coverImageId: string | null;
  coverImageUrl: string | null;
  isLoading: boolean;
  setCoverImage: (id: string, url: string) => void;
}

/**
 * Hook to poll for cover image generation and manage cover image state.
 *
 * When a project is created, the cover image is generated in the background.
 * This hook polls the project endpoint to detect when coverImageId becomes available,
 * then fetches the image URL from the generated images endpoint.
 *
 * This hook is the single source of truth for cover image state - use setCoverImage
 * for user-initiated updates (e.g., selecting an image from gallery).
 *
 * Polling behavior:
 * - Polls every 5 seconds when coverImageId is null
 * - Stops polling when coverImageId is detected
 * - Times out after 60 seconds to prevent infinite polling
 */
export const useCoverImage = ({
  projectId,
  initialCoverImageId,
  initialCoverImageUrl,
}: UseCoverImageOptions): UseCoverImageReturn => {
  // Single source of truth for cover image state
  const [coverImageId, setCoverImageId] = useState<string | null>(
    initialCoverImageId ?? null,
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialCoverImageUrl ?? null,
  );

  // Track polling timeout
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Determine if we should poll
  // Only poll when we don't have a coverImageId yet and haven't timed out
  const shouldPollProject = !coverImageId && !hasTimedOut;

  // Single timeout to stop polling after POLLING_TIMEOUT_MS
  useEffect(() => {
    if (coverImageId) return; // Already have image, no timeout needed

    const timeoutId = setTimeout(() => {
      setHasTimedOut(true);
    }, POLLING_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [coverImageId]);

  // Poll the project endpoint to detect when coverImageId becomes available
  const { data: projectData } = useSWR<ProjectWithRelations>(
    shouldPollProject ? `/api/projects/${projectId}` : null,
    fetcher,
    {
      refreshInterval: shouldPollProject ? POLLING_INTERVAL_MS : 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Update coverImageId when project data changes
  useEffect(() => {
    if (projectData?.project?.coverImageId) {
      setCoverImageId(projectData.project.coverImageId);
    }
  }, [projectData?.project?.coverImageId]);

  // Fetch the image URL when we have a coverImageId but no URL
  const shouldFetchImage = !!coverImageId && !coverImageUrl;

  const { data: imageData } = useSWR<GeneratedImage>(
    shouldFetchImage ? `/api/ai/generated-images/${coverImageId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Update coverImageUrl when image data is fetched
  useEffect(() => {
    if (imageData?.imageUrl) {
      setCoverImageUrl(imageData.imageUrl);
    }
  }, [imageData?.imageUrl]);

  // Allow external updates (e.g., user selects image from gallery)
  const setCoverImage = useCallback((id: string, url: string) => {
    setCoverImageId(id);
    setCoverImageUrl(url);
  }, []);

  // Only show loading when we've discovered a coverImageId (from polling)
  // but haven't fetched its URL yet. Polling itself is silent — we don't
  // want to show "Generating cover..." for projects that simply have no image.
  const isLoading = shouldFetchImage;

  return {
    coverImageId,
    coverImageUrl,
    isLoading,
    setCoverImage,
  };
};
