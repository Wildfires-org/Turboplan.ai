"use server";

import { createMagicLinkLoginTicket } from "@wildfires-org/turboplan-auth/server";
import { getInvitationService } from "@wildfires-org/turboplan-workspace/server";

import { signIn } from "@/app/(auth)/auth";
import { buildInviteLoginUrl } from "./login-url";

export interface AcceptInvitationState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_invitation"
    | "expired"
    | "already_accepted"
    | "login_required";
  redirectTo?: string;
  error?: string;
}

/**
 * Accept an invitation - creates the account for a not-yet-registered invited
 * email, signs it in, and accepts. Called when an unauthenticated user clicks
 * "Accept Invitation". Existing accounts get `login_required` instead.
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

    // An account already exists for the invited email. The invite link must
    // not sign it in: send the user through the normal login, back to this
    // invitation, where they accept while authenticated.
    if (result.status === "login_required") {
      return {
        status: "login_required",
        redirectTo: buildInviteLoginUrl(token, result.email),
      };
    }

    if (result.status !== "success" || !result.userId) {
      return {
        status: result.status,
        error: result.error,
      };
    }

    // Sign in the user (this must happen in Next.js context). The service
    // only returns success for an account it just created from this
    // invitation, so the ticket never signs in a pre-existing account.
    await signIn("magic-link", {
      ticket: createMagicLinkLoginTicket(result.userId),
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
