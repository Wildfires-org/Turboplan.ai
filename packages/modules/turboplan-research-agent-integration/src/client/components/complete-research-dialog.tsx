"use client";

import { Loader2 } from "lucide-react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

type CompleteResearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  isCompleting: boolean;
  onConfirm: () => void;
};

export const CompleteResearchDialog = ({
  open,
  onOpenChange,
  projectName,
  isCompleting,
  onConfirm,
}: CompleteResearchDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] gap-6 rounded-2xl p-6">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">Complete research?</DialogTitle>
            <span className="rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-900">
              {projectName}
            </span>
          </div>
          <DialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm">
                <span className="font-bold text-amber-500">
                  This action ends the deep research phase.{" "}
                </span>
                <span className="text-neutral-500">What happens next:</span>
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-neutral-500">
                <li>
                  You can start generating and drafting project documents.
                </li>
                <li>
                  You can still select and save items from the research panel to
                  your project.
                </li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isCompleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={onConfirm}
            disabled={isCompleting}
            className="bg-brand-800 text-white hover:bg-brand-900"
          >
            {isCompleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete research"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
