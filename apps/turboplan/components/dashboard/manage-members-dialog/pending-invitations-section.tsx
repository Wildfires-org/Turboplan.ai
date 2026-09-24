"use client";

import {
  type PendingInvitation,
  PendingInvitationItem,
} from "@wildfires-org/turboplan-workspace/client";

import { Separator } from "@/components/ui/separator";

interface PendingInvitationsSectionProps {
  invitations: PendingInvitation[];
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
  canManage: boolean;
  isResending: boolean;
  isRevoking: boolean;
}

export const PendingInvitationsSection = ({
  invitations,
  onResend,
  onRevoke,
  canManage,
  isResending,
  isRevoking,
}: PendingInvitationsSectionProps) => {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550">
          Pending Invitations ({invitations.length})
        </h3>
        <div className="max-h-[200px] overflow-y-auto space-y-3">
          {invitations.map((invitation) => (
            <PendingInvitationItem
              key={invitation.id}
              invitation={invitation}
              onResend={onResend}
              onRevoke={onRevoke}
              canManage={canManage}
              isResending={isResending}
              isRevoking={isRevoking}
            />
          ))}
        </div>
      </div>
    </>
  );
};
