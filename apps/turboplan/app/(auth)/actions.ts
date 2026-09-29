"use server";

import { after } from "next/server";
import { z } from "zod";

import { createMagicLinkLoginTicket } from "@wildfires-org/turboplan-auth/server";
import { hasChosenPlan } from "@wildfires-org/turboplan-billing/server";
import {
  consumeVerificationToken,
  createMagicLinkUser,
  createVerificationToken,
  getProfileByUserId,
  getUserByEmail,
  getUserById,
  getVerificationToken,
  markEmailAsVerified,
} from "@wildfires-org/turboplan-db/queries";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import { runPendingSelfServiceProjectSetups } from "@/app/self-service/helpers";
import { syncAffiliation } from "@/lib/affiliation-detection";
import {
  checkMagicLinkRequestLimit,
  checkMagicLinkVerifyLimit,
} from "@/lib/auth/rate-limit";
import { sendMagicLinkEmail } from "@/lib/email/send-magic-link";
import { aliasAnonymousId, captureServerEvent } from "@/lib/server-analytics";
import {
  buildAttributionEventProperties,
  parseSignupAttribution,
} from "@/lib/signup-attribution";
// getSetupStep not used here - we check profile directly since session isn't available in same request
import { signIn } from "./auth";

const emailSchema = z.object({
  email: z.string().email(),
});

// ============================================================================
// TYPES
// ============================================================================

export interface MagicLinkActionState {
  status:
    | "idle"
    | "in_progress"
    | "email_sent" // Always returned for valid email to prevent user enumeration
    | "failed"
    | "invalid_data";
}

export interface VerifyMagicLinkState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_token"
    | "expired";
  redirectTo?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Reads the landing-page attribution params (`ph_did`, `utm_*`, `gclid`) off a
 * form submission. The auth forms forward whatever arrived on their own URL, so
 * a signup that happens via the login form still carries the campaign that
 * produced it. Values are untrusted — parseSignupAttribution validates them.
 */
/**
 * A caller-supplied post-verification redirect target is only honored when it
 * is a same-site relative path. Rejects absolute URLs and protocol-relative
 * (`//host`) / backslash (`/\host`) forms that browsers treat as cross-origin,
 * closing the open-redirect via the magic-link `redirectTo` param.
 */
// Prefix checks alone are bypassable: the URL parser strips ASCII tab/newline
// before parsing, so "/\t/evil.com" and "///evil.com" both resolve to
// https://evil.com. Reject control chars, then confirm the path resolves to the
// same origin it is resolved against.
const isSafeRelativePath = (path: string): boolean => {
  if (!/^\/(?![/\\])/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) {
    return false;
  }
  try {
    return new URL(path, "http://x.invalid").origin === "http://x.invalid";
  } catch {
    return false;
  }
};

/** Optional post-login target from the login form; only safe paths pass. */
const redirectToFromFormData = (formData: FormData): string | undefined => {
  const value = formData.get("callbackUrl");
  return typeof value === "string" && isSafeRelativePath(value)
    ? value
    : undefined;
};

const attributionFromFormData = (formData: FormData) => {
  return parseSignupAttribution({
    get: (key) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : null;
    },
  });
};

function buildMagicLinkUrl(
  userId: string,
  token: string,
  type: "verification" | "login",
  redirectTo?: string,
  /**
   * Self-service signup only: the project created alongside the user, whose
   * cover image + research agent bootstrap are deferred until this link is
   * clicked. Re-checked against `createdBy` before anything runs.
   */
  setupProjectId?: string,
): string {
  const ENV = getWebEnv();
  const baseUrl = ENV.TURBOPLAN_URL;

  const params = new URLSearchParams();
  params.set("token", token);
  params.set("userId", userId);
  params.set("type", type);
  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }
  if (setupProjectId) {
    params.set("setupProjectId", setupProjectId);
  }

  return `${baseUrl}/verify?${params.toString()}`;
}

// Export for use in self-service and other flows
export { buildMagicLinkUrl };

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Request a magic link for registration (new user)
 * Creates user if not exists, sends verification email
 *
 * SECURITY: Always returns "email_sent" for valid emails to prevent user enumeration.
 * - If user doesn't exist: Creates user and sends verification email
 * - If user exists but not verified: Sends verification email
 * - If user exists and verified: Sends login email (helpful for user)
 */
export const requestRegistrationLink = async (
  _: MagicLinkActionState,
  formData: FormData,
): Promise<MagicLinkActionState> => {
  try {
    const validated = emailSchema.parse({
      email: formData.get("email"),
    });

    const email = validated.email.trim().toLowerCase();

    // Rate-limit before doing any work (email send / account creation).
    if (!(await checkMagicLinkRequestLimit(email))) {
      console.warn("[Register] Magic-link request rate limit exceeded", {
        email,
      });
      return { status: "failed" };
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      // If user exists but email not verified, send new verification link
      if (!existingUser.emailVerified) {
        const token = await createVerificationToken(
          existingUser.id,
          "email_verification",
        );
        const magicLinkUrl = buildMagicLinkUrl(
          existingUser.id,
          token,
          "verification",
        );

        await sendMagicLinkEmail({
          to: email,
          magicLinkUrl,
          type: "verification",
        });

        return { status: "email_sent" };
      }

      // User exists and is verified - send login link instead
      // This helps the user and doesn't reveal account existence differently
      const token = await createVerificationToken(existingUser.id, "login");
      const magicLinkUrl = buildMagicLinkUrl(existingUser.id, token, "login");

      await sendMagicLinkEmail({
        to: email,
        magicLinkUrl,
        type: "login",
      });

      // Return same status to prevent user enumeration
      return { status: "email_sent" };
    }

    // Create new user
    const [newUser] = await createMagicLinkUser(email);

    // Same treatment as the login auto-register branch: alias the pre-signup
    // anonymous person and record the signup at the earliest point the user
    // id exists, so /register signups are visible in the funnel too.
    const attribution = attributionFromFormData(formData);
    if (attribution?.ph_did) {
      aliasAnonymousId(newUser.id, attribution.ph_did);
    }
    captureServerEvent(newUser.id, "user_signed_up", {
      signup_flow: "register",
      ...buildAttributionEventProperties(attribution),
    });

    // Generate verification token
    const token = await createVerificationToken(
      newUser.id,
      "email_verification",
    );
    const magicLinkUrl = buildMagicLinkUrl(newUser.id, token, "verification");

    // Send verification email
    const emailResult = await sendMagicLinkEmail({
      to: email,
      magicLinkUrl,
      type: "verification",
    });

    if (!emailResult.success) {
      console.error(
        "[Register] Failed to send verification email:",
        emailResult.error,
      );
      // Still return email_sent to not reveal internal errors
      return { status: "email_sent" };
    }

    return { status: "email_sent" };
  } catch (error) {
    console.error("[Register] Error:", error);
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};

/**
 * Request a magic link for login (existing user)
 *
 * SECURITY: Always returns "email_sent" for valid emails to prevent user enumeration.
 * - If user doesn't exist: No email sent, but same response returned
 * - If user exists but not verified: Sends verification email
 * - If user exists and verified: Sends login email
 */
export const requestLoginLink = async (
  _: MagicLinkActionState,
  formData: FormData,
): Promise<MagicLinkActionState> => {
  try {
    const validated = emailSchema.parse({
      email: formData.get("email"),
    });

    const email = validated.email.trim().toLowerCase();
    const redirectTo = redirectToFromFormData(formData);

    // Rate-limit before doing any work (email send / account creation).
    if (!(await checkMagicLinkRequestLimit(email))) {
      console.warn("[Login] Magic-link request rate limit exceeded", { email });
      return { status: "failed" };
    }

    // Check if user exists
    const existingUser = await getUserByEmail(email);

    // If user doesn't exist, auto-register them and send verification email
    // This removes friction by allowing login to act as registration for new users
    if (!existingUser) {
      const [newUser] = await createMagicLinkUser(email);
      // Earliest point the user id exists — alias the pre-signup anonymous
      // PostHog person here so unverified-state events join the funnel too.
      const attribution = attributionFromFormData(formData);
      if (attribution?.ph_did) {
        aliasAnonymousId(newUser.id, attribution.ph_did);
      }
      captureServerEvent(newUser.id, "user_signed_up", {
        signup_flow: "login_auto_register",
        ...buildAttributionEventProperties(attribution),
      });
      const token = await createVerificationToken(
        newUser.id,
        "email_verification",
      );
      const magicLinkUrl = buildMagicLinkUrl(
        newUser.id,
        token,
        "verification",
        redirectTo,
      );

      await sendMagicLinkEmail({
        to: email,
        magicLinkUrl,
        type: "verification",
      });

      // Return same status as existing user to prevent user enumeration
      return { status: "email_sent" };
    }

    // Check if email is verified
    if (!existingUser.emailVerified) {
      // Send verification link instead of login link
      const token = await createVerificationToken(
        existingUser.id,
        "email_verification",
      );
      const magicLinkUrl = buildMagicLinkUrl(
        existingUser.id,
        token,
        "verification",
        redirectTo,
      );

      await sendMagicLinkEmail({
        to: email,
        magicLinkUrl,
        type: "verification",
      });

      // Return same status - user will receive verification email
      return { status: "email_sent" };
    }

    // Generate login token (15 min expiry, session lasts 30 days after login)
    const token = await createVerificationToken(existingUser.id, "login");
    const magicLinkUrl = buildMagicLinkUrl(
      existingUser.id,
      token,
      "login",
      redirectTo,
    );

    // Send login email
    const emailResult = await sendMagicLinkEmail({
      to: email,
      magicLinkUrl,
      type: "login",
    });

    if (!emailResult.success) {
      console.error("[Login] Failed to send login email:", emailResult.error);
      // Still return email_sent to not reveal internal errors
      return { status: "email_sent" };
    }

    return { status: "email_sent" };
  } catch (error) {
    console.error("[Login] Error:", error);
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};

/**
 * Verify a magic link token and sign in the user
 * @param redirectTo - Optional URL to redirect to after verification (from magic link)
 * @param _setupProjectId - Legacy: self-service magic links carry the created
 *   project's id, but deferred setup is now driven by the
 *   `selfServiceSetupPendingAt` flag stamped on the project at signup, so the
 *   URL parameter is ignored. Kept so already-sent links keep working.
 */
export const verifyMagicLink = async (
  userId: string,
  token: string,
  type: "verification" | "login",
  redirectTo?: string,
  _setupProjectId?: string,
): Promise<VerifyMagicLinkState> => {
  try {
    // Rate-limit verification attempts per IP (defense-in-depth).
    if (!(await checkMagicLinkVerifyLimit())) {
      // Throttled attempts are otherwise invisible: a burst of them is the
      // signal that someone is grinding tokens, so record it.
      console.warn(
        "[Verify] Rate limit exceeded for magic-link verification:",
        JSON.stringify({ userId, type }),
      );
      return { status: "failed" };
    }

    // Read-and-validate only — do NOT consume yet. Consuming here would burn a
    // still-valid link on any transient failure below (a DB blip on the user
    // lookup left the user with an unusable link and an `invalid_token` page).
    // Expired tokens are deleted and reported as invalid by this query, exactly
    // as before.
    const tokenRecord = await getVerificationToken(userId, token);
    if (!tokenRecord) {
      return { status: "invalid_token" };
    }

    // Validate token type matches expected type
    // This prevents using a verification token as a login token and vice versa
    const expectedTokenType =
      type === "verification" ? "email_verification" : "login";
    if (tokenRecord.type !== expectedTokenType) {
      return { status: "invalid_token" };
    }

    // Get user
    const user = await getUserById(userId);
    if (!user) {
      return { status: "failed" };
    }

    // Everything that can fail without changing state has now passed. Claim the
    // token atomically (DELETE ... RETURNING) immediately before the first
    // write: single-use is preserved because two concurrent verifications race
    // on the delete and only one of them gets the row back.
    const claimedToken = await consumeVerificationToken(userId, token);
    if (!claimedToken) {
      return { status: "invalid_token" };
    }

    // For verification tokens, mark email as verified
    const isFirstVerification = type === "verification" && !user.emailVerified;
    if (isFirstVerification) {
      await markEmailAsVerified(userId);
    }

    // Re-evaluate the user's affiliation from the email domain before signing
    // in, so the fresh JWT reflects any upgrade (e.g. an org added this user's
    // domain after they registered). Also ensures viewer membership of the
    // matched org. Upgrade-only; never downgrades or removes access. This is the
    // point where email ownership has just been proven, so granting access here
    // (rather than at signup) is safe.
    try {
      await syncAffiliation(userId, user.email);
    } catch (syncError) {
      console.error("[Verify] Affiliation sync failed:", syncError);
    }

    // Self-service signups defer cover image + research agent until the email
    // is proven. The work is driven by `selfServiceSetupPendingAt`, stamped on
    // the project at signup and cleared only after the setup fully succeeds —
    // so a failed attempt is retried on the user's next magic-link
    // verification instead of being skipped forever. Cheap no-op when nothing
    // is pending. after() keeps the serverless runtime alive past the
    // response, and the callback returns a promise covering ALL of the work —
    // anything left un-awaited inside it can be killed when the runtime
    // freezes.
    after(async () => {
      try {
        await runPendingSelfServiceProjectSetups(userId);
      } catch (setupError) {
        console.error("[Verify] Deferred project setup failed:", setupError);
      }
    });

    // Sign in the user using the magic-link provider. The provider only
    // accepts a server-minted signed ticket, never a bare userId.
    await signIn("magic-link", {
      ticket: createMagicLinkLoginTicket(user.id),
      redirect: false,
    });

    // Use provided redirectTo only when it is a safe same-site relative path.
    if (redirectTo && isSafeRelativePath(redirectTo)) {
      return { status: "success", redirectTo };
    }

    // Check if user needs to complete profile setup
    // We check directly using userId since session isn't available in same request
    const profile = await getProfileByUserId(userId);

    if (!profile) {
      // No profile - redirect to setup
      return { status: "success", redirectTo: "/setup/personal" };
    }

    // Check if profile is complete (has firstName and lastName)
    const isProfileComplete =
      profile.firstName &&
      profile.firstName.trim() !== "" &&
      profile.lastName &&
      profile.lastName.trim() !== "";

    if (!isProfileComplete) {
      // Profile exists but incomplete - redirect to setup
      return { status: "success", redirectTo: "/setup/personal" };
    }

    // Profile complete but no plan chosen on the personal org yet (pre-billing
    // accounts see this exactly once) - finish onboarding at the plan step.
    if (!(await hasChosenPlan(userId))) {
      return { status: "success", redirectTo: "/setup/plan" };
    }

    // Profile is complete - redirect to home
    return { status: "success", redirectTo: "/" };
  } catch (error) {
    console.error("[Verify] Error:", error);
    return { status: "failed" };
  }
};

// ============================================================================
// LEGACY EXPORTS (for backward compatibility during migration)
// ============================================================================

export interface LoginActionState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
  redirectTo?: string;
}

export interface RegisterActionState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
}

/**
 * Legacy login function - wraps requestLoginLink with backward-compatible response
 * Maps the new "email_sent" status to "success" for existing consumers
 * @deprecated Use requestLoginLink instead
 */
export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  const result = await requestLoginLink({ status: "idle" }, formData);

  // Map new status to legacy status
  if (result.status === "email_sent") {
    return { status: "success" };
  }
  return { status: result.status as LoginActionState["status"] };
};

/**
 * Legacy register function - wraps requestRegistrationLink with backward-compatible response
 * Maps the new "email_sent" status to "success" for existing consumers
 * @deprecated Use requestRegistrationLink instead
 */
export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  const result = await requestRegistrationLink({ status: "idle" }, formData);

  // Map new status to legacy status
  if (result.status === "email_sent") {
    return { status: "success" };
  }
  return { status: result.status as RegisterActionState["status"] };
};
