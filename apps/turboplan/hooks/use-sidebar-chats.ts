"use client";

import useSWR from "swr";

import type { Chat } from "@wildfires-org/turboplan-db/types";

import { fetcher } from "@/lib/utils";

interface UseSidebarChatsOptions {
  projectId: string | null;
}

export function getSidebarChatsKey(projectId: string | null) {
  return projectId ? `/api/projects/${projectId}/chats` : null;
}

export function useSidebarChats({ projectId }: UseSidebarChatsOptions) {
  const {
    data: chats = [],
    isLoading,
    error,
    mutate,
  } = useSWR<Array<Chat>>(getSidebarChatsKey(projectId), fetcher, {
    revalidateOnFocus: false,
  });

  return { chats, isLoading, error, mutate };
}
