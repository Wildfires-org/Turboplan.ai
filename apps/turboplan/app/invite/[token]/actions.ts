"use server";

import { getInvitationService } from "@wildfires-org/turboplan-workspace/server";

import { signIn } from "@/app/(auth)/auth";

export interface AcceptInvitationState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_invitation"
    | "expired"
    | "already_accepted";
  redirectTo?: string;
  error?: string;
}

/**
 * Accept an invitation - creates account if needed, signs in, and accepts.
 * This action is called when an unauthenticated user clicks "Accept Invitation".
 *
 * The business logic (user creation, invitation acceptance) is handled by
 * InvitationService. This action only handles the authentication/session part.
 */
export async function acceptInvitationWithAutoSignup(
  token: string,
): Promise<AcceptInvitationState> {
  try {
    const invitationService = getInvitationService();

    // Delegate business logic to the service
    const result =
      await invitationService.acceptInvitationWithAutoSignup(token);

    if (result.status !== "success" || !result.userId) {
      return {
        status: result.status,
        error: result.error,
      };
    }

    // Sign in the user (this must happen in Next.js context)
    await signIn("magic-link", {
      userId: result.userId,
      redirect: false,
    });

    return {
      status: "success",
      redirectTo: result.redirectTo,
    };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}
