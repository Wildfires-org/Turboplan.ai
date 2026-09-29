import type { ReactNode } from "react";

import { DashboardHeaderSkeleton } from "@/components/dashboard/dashboard-header";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import {
  CHAT_COMPOSER_SHELL_CLASS,
  CHAT_FORM_CLASS,
  CHAT_HEADER_CLASS,
  CHAT_MESSAGE_ROW_CLASS,
  RESEARCH_PANE_CLASS,
  RESEARCH_PANE_DEFAULT_WIDTH_CLASS,
  USER_BUBBLE_SHELL_CLASS,
} from "./chat-classes";

interface ProjectChatPageShellProps {
  children: ReactNode;
}

/** Full-height chat area under the 64px breadcrumb bar. Divides the UI
 * scale back out of `100vh` (see "Interface scale" in app/globals.css) so the
 * chat fills the window exactly; the page ground shows through. */
const CHAT_CONTAINER_CLASS =
  "h-[calc(100vh/var(--ui-scale)-64px)] overflow-hidden";

export function ProjectChatPageShell({ children }: ProjectChatPageShellProps) {
  return (
    <div className="w-full">
      <div className={CHAT_CONTAINER_CLASS}>{children}</div>
    </div>
  );
}

export function ProjectChatPageFallback({
  breadcrumbs,
  showResearchPane = false,
}: {
  breadcrumbs?: ReactNode;
  /** Reserve the research pane (auto-open while research is in progress). */
  showResearchPane?: boolean;
}) {
  return (
    <div className="flex min-h-screen shrink-0 flex-col">
      {breadcrumbs ?? <DashboardHeaderSkeleton crumbs={4} />}
      <ProjectChatPageShell>
        <div aria-busy="true" className="flex h-full">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Chat header — matches project-chat-header.tsx */}
            <div className={CHAT_HEADER_CLASS}>
              <div className="flex h-7 flex-1 items-center">
                <div
                  className={cn(SKELETON_BAR_CLASS, "h-4 w-64 max-w-[70%]")}
                />
              </div>
            </div>

            <ChatMessagesSkeleton />

            {/* Composer — matches project-chat.tsx form */}
            <div className={CHAT_FORM_CLASS}>
              <div className={cn(CHAT_COMPOSER_SHELL_CLASS, "h-[59px]")} />
            </div>
          </div>

          {showResearchPane && (
            <div
              aria-hidden
              className={cn(
                RESEARCH_PANE_CLASS,
                RESEARCH_PANE_DEFAULT_WIDTH_CLASS,
              )}
            >
              <div className="flex min-h-[72px] items-center border-b border-slate-900/[0.06] py-4 pl-3 pr-4">
                <div className="glass h-9 w-[120px] rounded-xl" />
              </div>
            </div>
          )}
        </div>
      </ProjectChatPageShell>
    </div>
  );
}

/** Message rows in the real message geometry (avatar + lines, user bubble),
 * bottom-aligned like a scrolled chat. Also used while messages load. */
export function ChatMessagesSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 flex-col justify-end gap-6 overflow-hidden pb-8 pt-4"
    >
      <AssistantSkeletonRow widths={["w-full", "w-4/5", "w-3/5"]} />

      <div className={CHAT_MESSAGE_ROW_CLASS}>
        <div className="ml-auto flex w-full max-w-2xl justify-end">
          <div
            className={cn(USER_BUBBLE_SHELL_CLASS, "h-11 w-[320px] max-w-full")}
          />
        </div>
      </div>

      <AssistantSkeletonRow widths={["w-full", "w-5/6", "w-full", "w-2/3"]} />
    </div>
  );
}

const AssistantSkeletonRow = ({ widths }: { widths: string[] }) => (
  <div className={CHAT_MESSAGE_ROW_CLASS}>
    <div className="flex w-full gap-4">
      <div className="glass size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-3 pt-2">
        {widths.map((width, index) => (
          <div
            key={`${width}-${index}`}
            className={cn(SKELETON_BAR_CLASS, "h-3.5", width)}
          />
        ))}
      </div>
    </div>
  </div>
);
