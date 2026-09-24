"use client";

import { PanelRightOpen } from "lucide-react";

import type { Chat } from "@wildfires-org/turboplan-db/types";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import {
  AvatarThinking,
  type PersonaState,
  useElapsedTime,
} from "@wildfires-org/turboplan-research-agent-integration/client";
import type { ResearchAgentStatus } from "@wildfires-org/turboplan-research-agent-integration/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { CHAT_HEADER_CLASS } from "./chat-classes";

export function ProjectChatHeader({
  selectedChat,
  isResearchPanelOpen,
  onToggleResearchPanel,
  researchAgentStatus,
}: {
  selectedChat: Chat;
  isResearchPanelOpen?: boolean;
  onToggleResearchPanel?: () => void;
  researchAgentStatus?: ResearchAgentStatus;
}) {
  const isAgentActive = researchAgentStatus?.hasActiveRun ?? false;
  const isAgentCompleted = researchAgentStatus?.status === "completed";

  const getPersonaState = (): PersonaState => {
    if (isAgentCompleted) {
      return "idle";
    }
    if (isAgentActive) {
      return "thinking";
    }
    return "asleep";
  };

  const personaState = getPersonaState();
  const elapsedTime = useElapsedTime(
    researchAgentStatus?.createdAt,
    researchAgentStatus?.updatedAt,
    isAgentActive,
  );

  return (
    <div className={CHAT_HEADER_CLASS}>
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-medium leading-7 tracking-[-0.02em] text-foreground">
            {selectedChat.title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-[10px]">
        {isResearchAgentPackageEnabled() &&
          onToggleResearchPanel &&
          !isResearchPanelOpen && (
            <>
              <button
                type="button"
                onClick={onToggleResearchPanel}
                aria-label="Open research panel"
                className="press flex cursor-pointer items-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                <AvatarThinking state={personaState} className="size-8" />
                {isAgentActive && elapsedTime && (
                  <span className="text-xs font-medium tabular-nums text-gray-550">
                    {elapsedTime}
                  </span>
                )}
              </button>
              <Button
                variant="glass"
                onClick={onToggleResearchPanel}
                className={cn(HEADER_ACTION_BUTTON_CLASS, "hidden md:flex")}
              >
                <PanelRightOpen aria-hidden />
                Research
              </Button>
            </>
          )}
      </div>
    </div>
  );
}
