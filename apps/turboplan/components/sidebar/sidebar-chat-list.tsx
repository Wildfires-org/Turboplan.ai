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
import { AppUrls } from "@/lib/nav/urls";

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
    <SidebarMenuSubItem>
      <div className="flex items-center">
        <SidebarMenuSubButton
          isActive={isOnChatsRoute}
          className={cn(
            "h-11 flex-1 rounded-lg pl-8 text-gray-550 hover:bg-brandAlt-100 hover:text-brandAlt-500 [&>svg]:text-current data-[active=true]:!bg-brandAlt-400 data-[active=true]:!text-white data-[active=true]:hover:!bg-brandAlt-400",
            isOnChatsRoute &&
              "!bg-brandAlt-400 !text-white shadow-sm hover:!bg-brandAlt-400 hover:!text-white",
          )}
          onClick={() => setIsChatExpanded((prev) => !prev)}
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform duration-200",
              isChatExpanded && "rotate-90",
            )}
          />
          <BotMessageSquare className="size-5" />
          <span className="flex-1">Chat</span>
        </SidebarMenuSubButton>
        <Tooltip>
          <TooltipTrigger asChild>
            {isNewChatDisabled ? (
              <Button
                variant="brandAlt"
                size="icon"
                className="size-8 ml-1"
                type="button"
                disabled
                aria-disabled={true}
                tabIndex={-1}
              >
                <Plus className="size-4" />
              </Button>
            ) : (
              <Button
                variant="brandAlt"
                size="icon"
                className="size-8 ml-1"
                asChild
              >
                <Link
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
          {isNewChatDisabled && (
            <TooltipContent>Complete research phase first</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Chat sub-list */}
      {isChatExpanded && (
        <div className="pl-10 py-1">
          {isLoadingChats ? (
            <div className="flex items-center gap-2 p-2 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : chats.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              No chats yet
            </div>
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
                    "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate",
                    chatActive && "text-brand-800 bg-brand-50 font-medium",
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
