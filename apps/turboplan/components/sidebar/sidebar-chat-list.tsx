"use client";

import { useState } from "react";

import {
  BotMessageSquare,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useNewChat } from "@/contexts/new-chat-context";
import { useSidebarChats } from "@/hooks/use-sidebar-chats";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import {
  PROJECT_NAV_SUB_BUTTON_CLASS,
  PROJECT_NAV_SUB_ITEM_CLASS,
} from "./sidebar-project-nav-classes";

/** Small neutral icon button: slate glyph on white with a hairline ring,
 * inset hairline, press scale + outline focus like the glass buttons. */
const NEW_CHAT_BUTTON_CLASS =
  "size-8 shrink-0 rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-900/10 transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 focus-visible:ring-1 focus-visible:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100 disabled:ring-slate-900/[0.08] motion-reduce:active:scale-100";

interface SidebarChatListProps {
  projectId: string;
  isResearchPhaseCompleted: boolean;
}

export function SidebarChatList({
  projectId,
  isResearchPhaseCompleted,
}: SidebarChatListProps) {
  const params = useParams<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
    chatId: string;
  }>();
  const pathname = usePathname();
  const { requestNewChat } = useNewChat();

  const { orgSlug, officeSlug, projectSlug } = params;

  const isOnChatsRoute =
    pathname.includes("/chats/") || pathname.includes("/chat");
  const [isChatExpanded, setIsChatExpanded] = useState(isOnChatsRoute);

  const { chats, isLoading: isLoadingChats } = useSidebarChats({
    projectId,
  });

  const hasInitialChat = chats.some((c) => c.isInitial);
  const isNewChatDisabled = hasInitialChat && !isResearchPhaseCompleted;

  return (
    <SidebarMenuSubItem
      data-active={isOnChatsRoute}
      className={PROJECT_NAV_SUB_ITEM_CLASS}
    >
      <div className="flex items-center gap-1">
        <SidebarMenuSubButton
          asChild
          isActive={isOnChatsRoute}
          className={cn(PROJECT_NAV_SUB_BUTTON_CLASS, "flex-1")}
        >
          <button
            type="button"
            aria-expanded={isChatExpanded}
            onClick={() => setIsChatExpanded((prev) => !prev)}
          >
            <BotMessageSquare />
            <span className="flex-1 text-left">Chat</span>
            <ChevronRight
              aria-hidden
              className={cn(
                "opacity-70 transition-transform duration-200 motion-reduce:transition-none",
                isChatExpanded && "rotate-90",
              )}
            />
          </button>
        </SidebarMenuSubButton>
        <Tooltip>
          <TooltipTrigger asChild>
            {isNewChatDisabled ? (
              // Wrapper takes the hover so the reason tooltip still shows
              // (a disabled button gets no pointer events).
              <span className="inline-flex shrink-0 cursor-not-allowed rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className={NEW_CHAT_BUTTON_CLASS}
                  type="button"
                  disabled
                  aria-disabled={true}
                  aria-label="New chat (complete research phase first)"
                  tabIndex={-1}
                >
                  <Plus className="size-4" />
                </Button>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={NEW_CHAT_BUTTON_CLASS}
                asChild
              >
                <Link
                  aria-label="New chat"
                  href={AppUrls.projectNewChat(
                    orgSlug,
                    officeSlug,
                    projectSlug,
                  )}
                  onClick={() => {
                    setIsChatExpanded(true);
                    requestNewChat();
                  }}
                >
                  <Plus className="size-4" />
                </Link>
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {isNewChatDisabled ? "Complete research phase first" : "New chat"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Chat sub-list */}
      {isChatExpanded && (
        <div className="py-1 pl-[30px]">
          {isLoadingChats ? (
            <div className="flex items-center gap-2 p-2 text-gray-550">
              <Loader2 className="size-3 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : chats.length === 0 ? (
            <div className="p-2 text-xs text-gray-550">No chats yet</div>
          ) : (
            chats.map((chatEntry) => {
              const chatHref = AppUrls.projectChatById(
                orgSlug,
                officeSlug,
                projectSlug,
                chatEntry.id,
              );
              const chatActive = pathname.endsWith(`/chats/${chatEntry.id}`);

              return (
                <Link
                  key={chatEntry.id}
                  href={chatHref}
                  className={cn(
                    "flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs text-gray-550 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400",
                    chatActive &&
                      "bg-slate-900/[0.06] font-medium text-slate-900",
                  )}
                >
                  {chatEntry.isInitial && (
                    <Sparkles className="size-3 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate">{chatEntry.title}</span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </SidebarMenuSubItem>
  );
}

/** Chat row before the project id is known: same pill, chevron and 32px
 * new-chat slot, so the real row swaps in without moving. */
export function SidebarChatRowPlaceholder() {
  return (
    <SidebarMenuSubItem className={PROJECT_NAV_SUB_ITEM_CLASS}>
      <div className="flex items-center gap-1">
        <SidebarMenuSubButton
          asChild
          className={cn(PROJECT_NAV_SUB_BUTTON_CLASS, "flex-1")}
        >
          <span aria-hidden>
            <BotMessageSquare />
            <span className="flex-1 text-left">Chat</span>
            <ChevronRight className="opacity-70" />
          </span>
        </SidebarMenuSubButton>
        <span
          aria-hidden
          className={cn(SKELETON_BAR_CLASS, "size-8 shrink-0 rounded-lg")}
        />
      </div>
    </SidebarMenuSubItem>
  );
}
