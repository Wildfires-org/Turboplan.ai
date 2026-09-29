"use client";

import { useCallback, useState } from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@wildfires-org/turboplan-utils";

import { useSaveToProjectContext } from "../contexts/save-to-project-context";
import { useResearchPanelWidth } from "../hooks/use-research-panel-width";
import { useResearchPhase } from "../hooks/use-research-phase";
import { CompleteResearchDialog } from "./complete-research-dialog";
import { SelectionIndicator } from "./ui/research-section";

type ResearchPanelFooterProps = {
  projectId: string;
  projectName: string;
  isResearchCompleted: boolean;
  totalSavedCount: number;
  hasItems: boolean;
  onComplete?: () => void;
};

export const ResearchPanelFooter = ({
  projectId,
  projectName,
  isResearchCompleted,
  totalSavedCount,
  hasItems,
  onComplete,
}: ResearchPanelFooterProps) => {
  const [panelWidth] = useResearchPanelWidth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { totalSelectedCount, isSaving, saveAll } = useSaveToProjectContext();
  const { isResearchPhaseCompleted, completeResearchPhase, isCompleting } =
    useResearchPhase(projectId);

  const handleCompleteResearch = useCallback(() => {
    completeResearchPhase().then(() => {
      toast.success("Research phase completed");
      setIsDialogOpen(false);
      onComplete?.();
    });
  }, [completeResearchPhase]);

  const isCompleteDisabled =
    isCompleting || isResearchPhaseCompleted || totalSavedCount === 0;

  if (!hasItems && totalSavedCount === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-slate-900/[0.06] bg-white/70 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {totalSavedCount > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-800 text-[11px] font-medium text-white">
                {totalSavedCount}
              </span>
              {(!panelWidth || panelWidth >= 595) && (
                <span>items saved to project</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {!isResearchPhaseCompleted && isResearchCompleted && (
            <Button
              variant="glass"
              onClick={() => setIsDialogOpen(true)}
              disabled={isCompleteDisabled}
              className="w-44"
            >
              Complete research
            </Button>
          )}
          {hasItems && (
            <Button
              onClick={() => {
                void saveAll();
              }}
              disabled={isSaving || totalSelectedCount < 1}
              variant="brand"
              className="w-44 gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : totalSelectedCount > 0 ? (
                <>
                  Save to project
                  <SelectionIndicator
                    selectedCount={totalSelectedCount}
                    variant="on-green"
                  />
                </>
              ) : (
                "Select items to save"
              )}
            </Button>
          )}
        </div>
      </div>
      <CompleteResearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectName={projectName}
        isCompleting={isCompleting}
        onConfirm={handleCompleteResearch}
      />
    </div>
  );
};
