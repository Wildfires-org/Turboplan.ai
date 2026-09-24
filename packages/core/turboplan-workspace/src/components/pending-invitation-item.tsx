"use client";

import { Clock, Mail, RotateCcw, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, Button } from "@wildfires-org/turboplan-utils";

import type { PendingInvitation } from "../hooks/use-member-management";

interface PendingInvitationItemProps {
  invitation: PendingInvitation;
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
  canManage: boolean;
  isResending?: boolean;
  isRevoking?: boolean;
}

/**
 * List item component for displaying pending invitations
 *
 * Shows invited email, role, inviter info, and expiration with action buttons
 * for resending or revoking the invitation.
 */
export function PendingInvitationItem({
  invitation,
  onResend,
  onRevoke,
  canManage,
  isResending = false,
  isRevoking = false,
}: PendingInvitationItemProps) {
  const getInviterName = () => {
    if (invitation.invitedBy.firstName || invitation.invitedBy.lastName) {
      return `${invitation.invitedBy.firstName || ""} ${invitation.invitedBy.lastName || ""}`.trim();
    }
    return invitation.invitedBy.email;
  };

  const formatExpirationDate = () => {
    const expiresAt = new Date(invitation.expiresAt);
    const now = new Date();
    const diffDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      return "Expired";
    } else if (diffDays === 0) {
      return "Expires today";
    } else if (diffDays === 1) {
      return "Expires tomorrow";
    } else {
      return `Expires in ${diffDays} days`;
    }
  };

  const isExpired = new Date(invitation.expiresAt) < new Date();

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-dashed p-3 ${
        isExpired
          ? "bg-destructive/5 border-destructive/30"
          : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
      }`}
    >
      <Avatar>
        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <Mail className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{invitation.email}</p>
          <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            Pending
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{invitation.role}</span>
          <span>•</span>
          <span>Invited by {getInviterName()}</span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs mt-0.5 ${
            isExpired ? "text-destructive" : "text-muted-foreground/80"
          }`}
        >
          <Clock className="size-3" />
          <span>{formatExpirationDate()}</span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResend(invitation.id)}
            disabled={isResending}
            title="Resend invitation"
          >
            <RotateCcw className="size-4 text-muted-foreground" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(invitation.id)}
            disabled={isRevoking}
            title="Revoke invitation"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}
