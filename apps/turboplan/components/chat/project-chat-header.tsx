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
    if (isAgentCompleted) return "idle";
    if (isAgentActive) return "thinking";
    return "asleep";
  };

  const personaState = getPersonaState();
  const elapsedTime = useElapsedTime(
    researchAgentStatus?.createdAt,
    researchAgentStatus?.updatedAt,
    isAgentActive,
  );

  return (
    <div className="flex items-center gap-5 px-6 py-4 flex-1 min-w-0 h-full">
      <div className="flex items-center gap-5 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xl truncate">{selectedChat.title}</h3>
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
                className="flex items-center cursor-pointer gap-2"
              >
                <AvatarThinking state={personaState} className="size-8" />
                {isAgentActive && elapsedTime && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {elapsedTime}
                  </span>
                )}
              </button>
              <Button
                variant="ghost-outline"
                onClick={onToggleResearchPanel}
                className="hidden md:flex gap-2 text-base font-semibold h-auto py-1.5 px-3"
              >
                <PanelRightOpen className="size-5 text-neutral-500" />
                Research
              </Button>
            </>
          )}
      </div>
    </div>
  );
}
