"use client";

import { useEffect, useRef } from "react";

import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import type { ResearchAgentStatus } from "../../types";
import { useResearchAgentStatus } from "../hooks/use-research-agent-status";

type ResearchUiState = "idle" | "running" | "completed" | "failed";

interface StartResearchButtonProps {
  projectId: string;
  /**
   * Whether the current user can edit the project (UPDATE permission).
   * The button renders nothing when false.
   */
  canEdit: boolean;
}

// Maps the raw status payload to the derived UI state. No `status` field means
// there is no run record yet (idle); an active run takes precedence over the
// terminal statuses.
const getResearchUiState = (
  status: ResearchAgentStatus | undefined,
): ResearchUiState => {
  if (status?.hasActiveRun) {
    return "running";
  }
  if (status?.status === "completed") {
    return "completed";
  }
  if (status?.status === "failed" || status?.status === "cancelled") {
    return "failed";
  }
  return "idle";
};

export function StartResearchButton({
  projectId,
  canEdit,
}: StartResearchButtonProps) {
  const { mutate: globalMutate } = useSWRConfig();

  const isEnabled = isResearchAgentPackageEnabled() && canEdit;

  // Reuses the canonical status hook, which polls (refreshInterval) only while a
  // run is active and stops when idle/terminal. Passing null disables fetching.
  const { status, refresh } = useResearchAgentStatus(
    isEnabled ? projectId : null,
  );

  const { trigger: triggerStart, isMutating: isStarting } = useSWRMutation(
    `/api/ai/research-agent/bootstrapper/project/${projectId}/start`,
    postFetcher,
  );

  const uiState = getResearchUiState(status);

  // When a run transitions running -> completed, revalidate the project-context
  // list so newly research-written entries appear live. The key mirrors the one
  // used by useProjectContext.
  const previousStateRef = useRef<ResearchUiState>(uiState);
  useEffect(() => {
    if (previousStateRef.current === "running" && uiState === "completed") {
      globalMutate(`/api/projects/${projectId}/context`);
    }
    previousStateRef.current = uiState;
  }, [uiState, projectId, globalMutate]);

  const handleStartResearch = async () => {
    try {
      await triggerStart({});
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start research",
      );
    }
  };

  if (!isEnabled) {
    return null;
  }

  if (uiState === "running") {
    const runningButton = (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="cursor-default border-white bg-white shadow-sm disabled:opacity-100"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Researching…
      </Button>
    );

    if (!status?.currentStep) {
      return runningButton;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{runningButton}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {status.currentStep}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (uiState === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Check className="size-3.5" aria-hidden />
        Research completed
      </span>
    );
  }

  const isFailed = uiState === "failed";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleStartResearch}
      disabled={isStarting}
      className="border-white bg-white shadow-sm hover:bg-white/90"
    >
      {isStarting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : isFailed ? (
        <RefreshCw className="size-4" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      {isFailed ? "Retry research" : "Start research"}
    </Button>
  );
}
