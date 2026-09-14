"use client";

import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Textarea,
} from "@wildfires-org/turboplan-utils";

interface RejectProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

export const RejectProposalDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: RejectProposalDialogProps) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Proposal</AlertDialogTitle>
          <AlertDialogDescription>
            Please provide a reason for rejecting this proposal. The citizen
            will be notified.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label
            htmlFor="rejection-reason"
            className="text-sm font-medium leading-none"
          >
            Reason notes
          </label>
          <Textarea
            id="rejection-reason"
            placeholder="Describe the reason for rejecting this proposal..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="border-0 shadow-none hover:bg-accent"
            disabled={isLoading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-neutral-900 text-white hover:bg-neutral-900/90"
            disabled={reason.trim() === "" || isLoading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm(reason.trim());
            }}
          >
            Reject
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
