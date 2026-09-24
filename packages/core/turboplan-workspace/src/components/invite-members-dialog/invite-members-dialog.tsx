"use client";

import { useCallback } from "react";

import { Info, Loader2 } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

import { useMemberInvitation } from "../../hooks";
import { MemberAssignRow } from "../member-assign-row";
import { PendingInviteeRow } from "./pending-invitee-row";
import type { PendingInvitee } from "./types";

interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  onSendInvitations: (invitees: PendingInvitee[]) => Promise<void>;
  isSubmitting?: boolean;
  /** Emails of existing members to exclude from search results */
  existingEmails?: Set<string>;
  /**
   * When true, the entity has an active seat-based subscription. Used to warn
   * that inviting non-viewer (Owner/Editor) members adds a paid seat. The
   * dialog stays billing-agnostic — all billing knowledge comes from this prop.
   */
  seatBillingActive?: boolean;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  entityName,
  onSendInvitations,
  isSubmitting = false,
  existingEmails,
  seatBillingActive = false,
}: InviteMembersDialogProps) {
  const {
    currentRole,
    excludedEmails,
    handleAssign,
    handleRemove,
    handleRoleChange,
    pendingInvitees,
    resetInvitations,
    selectedUsers,
    setCurrentRole,
    setSelectedUsers,
  } = useMemberInvitation({ existingEmails });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetInvitations();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetInvitations],
  );

  const handleSend = useCallback(async () => {
    if (pendingInvitees.length === 0) return;
    await onSendInvitations(pendingInvitees);
    resetInvitations();
  }, [onSendInvitations, pendingInvitees, resetInvitations]);

  // Viewers don't consume a paid seat — only Owner/Editor invites change the
  // bill, so the warning is gated on at least one non-viewer pending invitee.
  const hasBillableInvitee = pendingInvitees.some(
    (invitee) => invitee.role !== "viewer",
  );
  const showSeatBillingNotice = seatBillingActive && hasBillableInvitee;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[620px] p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-semibold">
              Invite Members
            </DialogTitle>
            <span className="inline-flex h-6 items-center rounded-full bg-brand-50 px-2.5 text-xs font-medium text-brand-900 ring-1 ring-inset ring-brand-800/15">
              {entityName}
            </span>
          </div>
          <DialogDescription>
            Invite new members to {entityName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Members section */}
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Add Members
            </span>
            <MemberAssignRow
              selectedUsers={selectedUsers}
              onSelectedUsersChange={setSelectedUsers}
              currentRole={currentRole}
              onRoleChange={setCurrentRole}
              onAssign={handleAssign}
              disabled={isSubmitting}
              excludeEmails={excludedEmails}
            />
          </div>

          {/* Pending invitees list */}
          {pendingInvitees.length > 0 && (
            <>
              <div className="h-px bg-slate-900/[0.06]" />
              <div className="max-h-[240px] space-y-4 overflow-y-auto">
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
        </div>

        {showSeatBillingNotice && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Heads up: Owner and Editor members each use a paid seat. Sending
              these invitations will add seat(s) to your subscription and adjust
              your next invoice (prorated). Viewers don&apos;t use a seat.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button
            variant="glass"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            variant="brand"
            disabled={pendingInvitees.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Invitation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
