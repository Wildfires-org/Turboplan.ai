"use client";

import { useCallback, useState } from "react";

import { toast } from "@wildfires-org/turboplan-utils";
import type { PendingInvitee } from "@wildfires-org/turboplan-workspace/client";

import { sendInvitations } from "@/lib/send-invitations";

interface UseSendInvitationsOptions {
  addMember: (params: { email: string; role: string }) => Promise<unknown>;
  onSuccess?: () => void;
}

export function useSendInvitations({
  addMember,
  onSuccess,
}: UseSendInvitationsOptions) {
  const [isSending, setIsSending] = useState(false);

  const handleSendInvitations = useCallback(
    async (invitees: PendingInvitee[]) => {
      setIsSending(true);
      const { succeeded, failed } = await sendInvitations(invitees, addMember);
      setIsSending(false);

      if (failed > 0) {
        toast({
          type: "error",
          description: `${succeeded} invited, ${failed} failed.`,
        });
      } else {
        toast({
          type: "success",
          description: `${succeeded} invitation${succeeded > 1 ? "s" : ""} sent.`,
        });
      }

      onSuccess?.();
    },
    [addMember, onSuccess],
  );

  return { handleSendInvitations, isSending };
}
