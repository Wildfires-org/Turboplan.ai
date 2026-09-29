"use client";

import { useState } from "react";

import { Check, Info, X } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";

import { patchFetcher } from "@wildfires-org/turboplan-api-client";
import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";
import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { ApproveProposalDialog } from "./approve-proposal-dialog";
import { RejectProposalDialog } from "./reject-proposal-dialog";

interface SubmissionInfoBannerProps {
  organizationName: string;
  ownershipStatus: string | null;
  projectId: string;
  projectName: string;
  userId?: string;
}

export const SubmissionInfoBanner = ({
  organizationName,
  ownershipStatus,
  projectId,
  projectName,
  userId,
}: SubmissionInfoBannerProps) => {
  const isCitizen = useIsCitizen();
  const router = useRouter();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { trigger: triggerReview, isMutating } = useSWRMutation(
    `/api/projects/${projectId}/review`,
    patchFetcher,
  );

  // The server requires MANAGE_MEMBERS on the submission's target office. While
  // SUBMITTED the project lives in that office and every direct member was
  // downgraded to Viewer, so project-level MANAGE_MEMBERS effectively is the
  // inherited office/org (or platform admin) grant.
  const { hasPermission: canReview, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.MANAGE_MEMBERS,
  });

  if (ownershipStatus !== OwnershipStatus.SUBMITTED) {
    return null;
  }

  const handleApprove = async (data: {
    ownerEmail?: string;
    members: Array<{ email: string; role: string }>;
  }) => {
    try {
      await triggerReview({
        action: "accepted",
        ownerEmail: data.ownerEmail,
        members: data.members.length > 0 ? data.members : undefined,
      });

      toast({
        type: "success",
        description: "Proposal has been approved successfully.",
      });
      setShowApproveDialog(false);
      router.refresh();
    } catch {
      toast({
        type: "error",
        description: "Failed to approve the proposal.",
      });
    }
  };

  const handleReject = async (rejectionReason: string) => {
    try {
      await triggerReview({ action: "rejected", rejectionReason });

      toast({
        type: "success",
        description: "Proposal has been rejected successfully.",
      });
      router.refresh();
    } catch {
      toast({
        type: "error",
        description: "Failed to reject the proposal.",
      });
    }
  };

  if (isCitizen) {
    return (
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="container mx-auto flex items-center gap-2 px-6 py-3">
          <Info className="size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            This application has been submitted to {organizationName}. You are
            currently viewing it in read-only mode.
          </p>
        </div>
      </div>
    );
  }

  const showActions = !isChecking && canReview;

  return (
    <>
      <div className="border-b border-blue-300 bg-blue-50">
        <div className="container mx-auto flex items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-3">
            <Info className="size-4 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-600">
              {showActions
                ? "This proposal was submitted by a citizen and is awaiting your review."
                : "This proposal was submitted by a citizen and is awaiting review by a project owner."}
            </p>
          </div>
          {showActions ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-error-200 bg-error-50 text-error-700 hover:bg-red-100 hover:text-error-700"
                onClick={() => setShowRejectDialog(true)}
                disabled={isMutating}
              >
                {isMutating ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-red-300 border-t-error-700" />
                ) : (
                  <X className="size-4" />
                )}
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-brand-100 bg-brand-50 text-brand-700 hover:bg-green-100 hover:text-brand-700"
                onClick={() => setShowApproveDialog(true)}
                disabled={isMutating}
              >
                <Check className="size-4" />
                Approve
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {showActions ? (
        <>
          <ApproveProposalDialog
            open={showApproveDialog}
            onOpenChange={setShowApproveDialog}
            projectId={projectId}
            projectName={projectName}
            onApprove={handleApprove}
            isLoading={isMutating}
          />
          <RejectProposalDialog
            open={showRejectDialog}
            onOpenChange={setShowRejectDialog}
            onConfirm={handleReject}
            isLoading={isMutating}
          />
        </>
      ) : null}
    </>
  );
};
