"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import {
  type CommentData,
  type CommentPermissions,
  CommentsSection,
  getCommentCount,
} from "@wildfires-org/turboplan-utils";

import { PublicModuleSection } from "./public-module-section";

const { SERVER_URL, TURBOPLAN_URL } = getLandingPageEnv();

// Polling configuration for auto-response detection
const POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds
const POLLING_DURATION_MS = 30000; // Poll for 30 seconds after submission

interface PublicCommentsSectionProps {
  orgSlug: string;
  officeSlug: string;
  projectSlug: string;
  initialComments: CommentData[];
  sessionUser: { id: string } | null;
}

const apiClient = new ApiClient({ baseUrl: SERVER_URL });

/**
 * Fetch comments for a public project.
 * If isLoggedIn is true, attempts to get auth token and include it in the request
 * so the user can see their own private comments.
 */
async function fetchPublicComments(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
  isLoggedIn: boolean,
): Promise<CommentData[]> {
  const url = `${SERVER_URL}/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/comments`;

  // Include auth token so the server can return private comments and auto-responses for this user
  const headers: HeadersInit = {};
  if (isLoggedIn) {
    try {
      const token = await apiClient.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // Proceed without auth - user will only see public comments
    }
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.comments || [];
}

export function PublicCommentsSection({
  orgSlug,
  officeSlug,
  projectSlug,
  initialComments,
  sessionUser,
}: PublicCommentsSectionProps) {
  const [isPolling, setIsPolling] = useState(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggedIn = !!sessionUser;

  // Clean up polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  const { data: comments, mutate } = useSWR(
    ["public-comments", orgSlug, officeSlug, projectSlug, isLoggedIn],
    () => fetchPublicComments(orgSlug, officeSlug, projectSlug, isLoggedIn),
    {
      fallbackData: initialComments,
      revalidateOnFocus: false,
      // Only poll when waiting for auto-response
      refreshInterval: isPolling ? POLLING_INTERVAL_MS : 0,
    },
  );

  /**
   * Start polling for auto-response updates.
   * Polls every 3 seconds for 30 seconds, then stops.
   */
  const startPolling = useCallback(() => {
    // Clear any existing timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    setIsPolling(true);

    // Stop polling after the duration
    pollingTimeoutRef.current = setTimeout(() => {
      setIsPolling(false);
    }, POLLING_DURATION_MS);
  }, []);

  const handleCreateComment = useCallback(
    async (content: string) => {
      if (!sessionUser) return;

      const { error } = await apiClient.post<CommentData>(
        `/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/comments`,
        { content },
      );

      if (error) {
        console.error("Failed to create comment:", error);
        return;
      }

      // Immediately refresh to show the new comment
      await mutate();

      // Start polling to catch the auto-response when it's generated
      startPolling();
    },
    [orgSlug, officeSlug, projectSlug, sessionUser, mutate, startPolling],
  );

  const handleReply = useCallback(
    async (parentCommentId: string, content: string) => {
      if (!sessionUser) return;

      const { error } = await apiClient.post<CommentData>(
        `/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/comments`,
        { content, parentCommentId },
      );

      if (error) {
        console.error("Failed to create reply:", error);
        return;
      }

      // Refresh to show the new reply
      await mutate();
    },
    [orgSlug, officeSlug, projectSlug, sessionUser, mutate],
  );

  const permissions: CommentPermissions = {
    currentUserId: sessionUser?.id ?? null,
    canModerate: false,
  };

  const commentList = comments ?? [];

  return (
    <PublicModuleSection
      title="Comments"
      icon={<MessageSquare />}
      count={getCommentCount(commentList)}
    >
      <div className="space-y-4">
        <CommentsSection
          comments={commentList}
          permissions={permissions}
          readOnly={!isLoggedIn}
          hideVisibilityIndicator={true}
          onSubmit={isLoggedIn ? handleCreateComment : undefined}
          onReply={isLoggedIn ? handleReply : undefined}
          withAccordion={false}
        />

        {!isLoggedIn && (
          <p className="flex flex-wrap items-center justify-center gap-x-1.5 rounded-xl bg-brandAlt-100 px-4 py-4 text-center font-inter text-[14px] leading-[20px] text-egray-700">
            <Link
              href={`${TURBOPLAN_URL}/login`}
              className="font-medium text-brand-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              Sign in
            </Link>
            <span>to leave a comment</span>
          </p>
        )}
      </div>
    </PublicModuleSection>
  );
}
