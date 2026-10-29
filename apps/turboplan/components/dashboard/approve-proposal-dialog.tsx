"use client";

import { useCallback, useMemo, useState } from "react";

import { Loader2 } from "lucide-react";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@wildfires-org/turboplan-utils";
import {
  MemberAssignRow,
  PendingInviteeRow,
  type SelectedUserValue,
  UserSelector,
  useMemberInvitation,
} from "@wildfires-org/turboplan-workspace/client";

// ============================================================================
// TYPES
// ============================================================================

interface ApproveProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The submitted project. While under review it sits in the target office,
   * so the owner/member search covers the reviewing organization.
   */
  projectId: string;
  projectName: string;
  onApprove: (data: {
    ownerEmail?: string;
    members: Array<{ email: string; role: string }>;
  }) => Promise<void>;
  isLoading: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ApproveProposalDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onApprove,
  isLoading,
}: ApproveProposalDialogProps) {
  // Owner selection state
  const [ownerSelection, setOwnerSelection] = useState<SelectedUserValue[]>([]);

  const ownerEmail = useMemo(() => {
    if (ownerSelection.length === 0) {
      return undefined;
    }
    return ownerSelection[0].email;
  }, [ownerSelection]);

  // The owner can't also be added as a member.
  const ownerEmails = useMemo(
    () => new Set(ownerEmail ? [ownerEmail.toLowerCase()] : []),
    [ownerEmail],
  );

  const {
    addInvitees,
    currentRole,
    excludedEmails: excludedEmailsForMembers,
    handleRemove,
    handleRoleChange,
    pendingInvitees,
    resetInvitations,
    setCurrentRole,
  } = useMemberInvitation({ existingEmails: ownerEmails });

  const excludedEmailsForOwner = useMemo(() => {
    const emails = new Set<string>();
    for (const invitee of pendingInvitees) {
      emails.add(invitee.email.toLowerCase());
    }
    return emails;
  }, [pendingInvitees]);

  const searchScope = { entityType: EntityType.PROJECT, entityId: projectId };

  const resetState = useCallback(() => {
    setOwnerSelection([]);
    resetInvitations();
  }, [resetInvitations]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetState();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetState],
  );

  const handleApprove = useCallback(async () => {
    await onApprove({
      ownerEmail,
      members: pendingInvitees.map((invitee) => ({
        email: invitee.email,
        role: invitee.role,
      })),
    });
  }, [onApprove, ownerEmail, pendingInvitees]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[620px] gap-6 sm:rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-xl font-semibold leading-8 tracking-normal">
              Approve Proposal
            </DialogTitle>
            <span className="rounded bg-neutral-200 px-2 py-1 text-xs leading-4 text-gray-950">
              {projectName}
            </span>
          </div>
          <DialogDescription className="text-gray-350">
            Approving this proposal will create a project. Assign the
            responsible owner and department to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Project Owner */}
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-neutral-500">
              Add Project Owner
            </Label>
            <UserSelector
              value={ownerSelection}
              onChange={setOwnerSelection}
              searchScope={searchScope}
              maxSelections={1}
              placeholder="Name or email"
              allowInvite
              excludeEmails={excludedEmailsForOwner}
              disabled={isLoading}
            />
          </div>

          {/* Add Members */}
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-neutral-500">
              Add Members
            </Label>
            <MemberAssignRow
              onAdd={addInvitees}
              searchScope={searchScope}
              currentRole={currentRole}
              onRoleChange={setCurrentRole}
              disabled={isLoading}
              excludeEmails={excludedEmailsForMembers}
            />
          </div>

          {/* Pending invitees list */}
          {pendingInvitees.length > 0 && (
            <>
              <div className="h-px bg-neutral-200" />
              <div className="max-h-60 space-y-4 overflow-y-auto">
                {pendingInvitees.map((invitee) => (
                  <PendingInviteeRow
                    key={invitee.id}
                    invitee={invitee}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </>
          )}

          <div className="h-px bg-neutral-200" />

          <DialogFooter className="gap-3 pt-4 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              className="text-gray-950"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              className="bg-foreground text-background hover:bg-foreground/90"
              onClick={handleApprove}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
