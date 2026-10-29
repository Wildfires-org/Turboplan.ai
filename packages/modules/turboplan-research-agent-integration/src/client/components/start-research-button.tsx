"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import {
  Button,
  cn,
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
  /** Surface style: "outline" (white, default) or "glass" (glass UI hosts). */
  appearance?: "outline" | "glass";
  /** Icon-only button with the label in a tooltip, for narrow card headers. */
  iconOnly?: boolean;
}

const APPEARANCE_CLASS = {
  outline: "border-white bg-white shadow-sm hover:bg-white/90",
  glass: "rounded-lg text-foreground",
} as const;

const ICON_ONLY_CLASS = "size-7 rounded-lg p-0";

/** Wraps a control in a tooltip; `focusable` for disabled buttons, which
 * cannot receive focus themselves. */
const WithTooltip = ({
  label,
  focusable = false,
  children,
}: {
  label: string;
  focusable?: boolean;
  children: ReactNode;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        {focusable ? <span tabIndex={0}>{children}</span> : children}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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
  appearance = "outline",
  iconOnly = false,
}: StartResearchButtonProps) {
  const variant = appearance === "glass" ? "glass" : "outline";
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

  const isFailed = uiState === "failed";

  const renderIconOnly = () => {
    if (uiState === "running") {
      return (
        <WithTooltip label={status?.currentStep ?? "Researching…"} focusable>
          <Button
            variant={variant}
            size="icon"
            disabled
            aria-label="Researching…"
            className={cn(
              APPEARANCE_CLASS[appearance],
              ICON_ONLY_CLASS,
              "cursor-default disabled:opacity-100",
            )}
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </Button>
        </WithTooltip>
      );
    }

    if (uiState === "completed") {
      return (
        <WithTooltip label="Research completed" focusable>
          <span
            role="img"
            aria-label="Research completed"
            className="flex size-7 items-center justify-center text-muted-foreground"
          >
            <Check className="size-4" aria-hidden />
          </span>
        </WithTooltip>
      );
    }

    const label = isFailed ? "Retry research" : "Start research";
    return (
      <WithTooltip label={label}>
        <Button
          variant={variant}
          size="icon"
          onClick={handleStartResearch}
          disabled={isStarting}
          aria-label={label}
          className={cn(APPEARANCE_CLASS[appearance], ICON_ONLY_CLASS)}
        >
          {isStarting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : isFailed ? (
            <RefreshCw className="size-4" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
        </Button>
      </WithTooltip>
    );
  };

  if (iconOnly) {
    return renderIconOnly();
  }

  if (uiState === "running") {
    const runningButton = (
      <Button
        variant={variant}
        size="sm"
        disabled
        className={cn(
          APPEARANCE_CLASS[appearance],
          "cursor-default disabled:opacity-100",
        )}
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

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleStartResearch}
      disabled={isStarting}
      className={APPEARANCE_CLASS[appearance]}
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
