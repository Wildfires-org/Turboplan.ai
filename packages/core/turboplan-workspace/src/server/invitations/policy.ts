/**
 * Pure invitation decisions, kept free of DB imports so they are unit-testable.
 */

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * An invitation may only be accepted by the account it was sent to. Without
 * this, anyone holding a forwarded/leaked link could redeem the grant into
 * their own account.
 */
export const isInvitationEmailMatch = (
  userEmail: string | null | undefined,
  invitationEmail: string,
): boolean => {
  if (!userEmail) {
    return false;
  }
  return normalizeEmail(userEmail) === normalizeEmail(invitationEmail);
};

export class InvitationEmailMismatchError extends Error {
  constructor() {
    super(
      "This invitation was sent to a different email address. Sign in with that account to accept it.",
    );
    this.name = "InvitationEmailMismatchError";
  }
}

export type AutoSignupDecision = "create_and_sign_in" | "login_required";

/**
 * The unauthenticated accept flow may only sign in an account it has just
 * created. If an account for the invited email already exists (registered
 * after the invite was sent), the invitation link must not act as a login
 * credential for it: the user signs in normally and accepts while
 * authenticated.
 */
export const decideAutoSignup = (
  existingUser: { id: string } | null | undefined,
): AutoSignupDecision => {
  return existingUser ? "login_required" : "create_and_sign_in";
};
