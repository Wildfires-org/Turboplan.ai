import type { ReactNode } from "react";

import { Skeleton } from "@wildfires-org/turboplan-utils";

import { DashboardHeaderSkeleton } from "@/components/dashboard/dashboard-header";

interface ProjectChatPageShellProps {
  children: ReactNode;
  containerHeight?: string;
}

const DEFAULT_CHAT_CONTAINER_HEIGHT = "calc(100vh - 64px)";

export function ProjectChatPageShell({
  children,
  containerHeight = DEFAULT_CHAT_CONTAINER_HEIGHT,
}: ProjectChatPageShellProps) {
  return (
    <div className="w-full">
      <div className="space-y-6">
        <div
          className="bg-card overflow-hidden"
          style={{ height: containerHeight }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ProjectChatPageFallback({
  breadcrumbs,
}: {
  breadcrumbs?: ReactNode;
}) {
  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      {breadcrumbs ?? <DashboardHeaderSkeleton crumbs={4} />}
      <ProjectChatPageShell>
        <div className="flex h-full flex-col">
          {/* Chat header — matches project-chat-header.tsx */}
          <div className="shrink-0 border-b border-border min-h-[72px] flex items-center gap-5 px-6 py-4">
            <Skeleton className="h-7 w-[70%]" />
          </div>

          {/* Messages area — matches message.tsx layout */}
          <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-hidden pt-4 pb-8 justify-end">
            {/* Assistant message */}
            <div className="w-full mx-auto max-w-3xl px-4">
              <div className="flex gap-4 w-full">
                <Skeleton className="size-8 shrink-0 rounded-full ring-1 ring-border" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            </div>

            {/* User message */}
            <div className="w-full mx-auto max-w-3xl px-4">
              <div className="flex gap-4 w-full ml-auto max-w-2xl">
                <div className="ml-auto">
                  <Skeleton className="h-[52px] w-[320px] rounded-xl bg-chat-user/40" />
                </div>
              </div>
            </div>

            {/* Assistant message */}
            <div className="w-full mx-auto max-w-3xl px-4">
              <div className="flex gap-4 w-full">
                <Skeleton className="size-8 shrink-0 rounded-full ring-1 ring-border" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          </div>

          {/* Input area — matches project-multimodal-input.tsx */}
          <div className="mx-auto w-full px-4 pb-4 md:pb-6 md:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
            <Skeleton className="h-[52px] w-full rounded-xl" />
          </div>
        </div>
      </ProjectChatPageShell>
    </div>
  );
}
