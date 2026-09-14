import type { PendingInvitee } from "@wildfires-org/turboplan-workspace/client";

/**
 * Sends invitations to multiple users in parallel and returns the result counts.
 * Callers are responsible for UI feedback (toasts, state updates, etc.).
 */
export async function sendInvitations(
  invitees: PendingInvitee[],
  addMember: (params: { email: string; role: string }) => Promise<unknown>,
): Promise<{ succeeded: number; failed: number }> {
  const results = await Promise.allSettled(
    invitees.map((invitee) =>
      addMember({ email: invitee.email, role: invitee.role }),
    ),
  );
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { succeeded, failed };
}
