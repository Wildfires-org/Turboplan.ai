"use server";

import { z } from "zod";

import {
  activateStarterPlan,
  assertProjectCreationAllowed,
} from "@wildfires-org/turboplan-billing/server";
import { project, projectUsers, UserRole } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  createMagicLinkUserWithProfile,
  createVerificationToken,
  getUserByEmail,
  saveChat,
} from "@wildfires-org/turboplan-db/queries";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { generateUniqueSlug } from "@wildfires-org/turboplan-utils/server";
import {
  getOrCreatePersonalWorkspace,
  getOrganizationById,
} from "@wildfires-org/turboplan-workspace/server";
import {
  MemberRole,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/types";

import { sendMagicLinkEmail } from "@/lib/email/send-magic-link";
import { aliasAnonymousId, captureServerEvent } from "@/lib/server-analytics";
import { buildAttributionEventProperties } from "@/lib/signup-attribution";
import { buildMagicLinkUrl } from "../(auth)/actions";
import {
  buildFallbackProjectDescription,
  buildProjectChatUrl,
  sanitizeName,
} from "./helpers";
import {
  type CreateUserWithOrganizationResult,
  type SelfServiceInput,
  selfServiceSchema,
} from "./types";

/**
 * Create a new user with their personal workspace and first project
 * This is the main self-service registration flow.
 *
 * The project is ALWAYS created in the user's PERSONAL organization as a DRAFT
 * the user owns. When a government organizationId (+ officeId) is provided, the
 * draft is then submitted to that gov org/office for review via the shared
 * submit-for-review flow (the project physically moves into the gov office and
 * the user is downgraded to viewer, mirroring the in-app submit path).
 *
 * TODO: This is a legacy "use server" action. It should eventually be migrated
 * to a Hono endpoint per the backend conventions; not migrating now to keep the
 * change scoped.
 */
export async function createUserWithOrganization(
  data: SelfServiceInput,
): Promise<CreateUserWithOrganizationResult> {
  try {
    // Validate input
    const validated = selfServiceSchema.parse(data);

    // Check if user already exists
    const existingUser = await getUserByEmail(validated.email);
    if (existingUser) {
      return { status: "user_exists" };
    }

    // If organizationId provided, validate it's a government organization. This
    // is now the SUBMIT target (not the creation target); the office it must
    // belong to is validated by submitProjectForReview after creation.
    if (validated.organizationId) {
      const targetGovtOrg = await getOrganizationById(validated.organizationId);
      if (!targetGovtOrg) {
        return {
          status: "invalid_data",
          error: "Specified organization not found",
        };
      }

      // Validate it's a government organization
      if (targetGovtOrg.type !== OrganizationType.GOVERNMENT) {
        return {
          status: "invalid_data",
          error: "Can only link to government organizations",
        };
      }
    }

    // Create user with profile (includes personal organization and empty profile
    // for self-service). Self-service users get a profile immediately since they
    // skip onboarding.
    //
    // The user is created as a plain CITIZEN here — NO elevated role or
    // organization membership is granted at signup, because the email has not
    // yet been verified (proving ownership of a government/environmental-planning
    // domain before verification would let anyone claim it). The role upgrade and
    // viewer membership are granted by `syncAffiliation` when the user first
    // clicks their magic link (email ownership proven) — see verifyMagicLink.
    const [newUser] = await createMagicLinkUserWithProfile(
      validated.email,
      UserRole.CITIZEN,
    );

    if (!newUser) {
      return { status: "failed", error: "Failed to create user" };
    }

    // Identity + attribution are stamped at the EARLIEST point the user id
    // exists, before email verification, so the pre-signup anonymous session
    // and every unverified-state event still join this person. The alias is
    // fire-and-forget and never blocks signup.
    const { attribution } = validated;
    if (attribution?.ph_did) {
      aliasAnonymousId(newUser.id, attribution.ph_did);
    }
    captureServerEvent(newUser.id, "user_signed_up", {
      signup_flow: "self_service",
      ...buildAttributionEventProperties(attribution),
    });

    // The project is always created in the user's PERSONAL workspace: the
    // personal org plus its single "My Projects" office, both created together
    // with the user above. Resolved BEFORE the transaction because the helper
    // uses a different db connection (calling it inside would risk a deadlock).
    const { organization: personalOrg, office: personalOffice } =
      await getOrCreatePersonalWorkspace(newUser.id, validated.email);

    // Refactor-proofing, not a live gate: this flow only runs for brand-new
    // users (existing emails bail out above), so the fresh personal org is
    // always within the Starter limit. The explicit check keeps the invariant
    // enforced if that assumption ever changes.
    if (isBillingPackageEnabled()) {
      const decision = await assertProjectCreationAllowed({
        organizationId: personalOrg.id,
      });
      if (!decision.allowed) {
        return {
          status: "failed",
          error: "This workspace has reached its plan's project limit.",
        };
      }
    }

    // Optimize transaction - remove N+1 query pattern by creating everything in one transaction
    const result = await db.transaction(async (tx) => {
      try {
        const now = new Date();

        // The project is ALWAYS created in the user's PERSONAL workspace as a
        // DRAFT they own. The government org (when provided) is the SUBMIT
        // target, handled after the transaction via submitProjectForReview —
        // not the creation target.
        const targetOrg = personalOrg;
        const targetOffice = personalOffice;

        const sanitizedProjectTitle = sanitizeName(validated.projectTitle);

        // Calculate default end date (180 days from now)
        const defaultEndDate = new Date(now);
        defaultEndDate.setDate(defaultEndDate.getDate() + 180);

        // Generate unique project slug
        const projectSlug = generateUniqueSlug(sanitizedProjectTitle);

        // Create project with the provided project title and description
        const [newProject] = await tx
          .insert(project)
          .values({
            name: sanitizedProjectTitle,
            slug: projectSlug,
            description:
              validated.projectDescription ||
              buildFallbackProjectDescription(sanitizedProjectTitle),
            officeId: targetOffice.id,
            createdBy: newUser.id,
            lastModifiedBy: newUser.id,
            status: "active",
            isTemplate: false,
            startDate: now,
            endDate: defaultEndDate,
            // Saved default submit target (a gov org/office picked at signup);
            // the project stays in the personal workspace until explicitly
            // submitted.
            intendedSubmissionOrganizationId: validated.organizationId ?? null,
            intendedSubmissionOfficeId: validated.officeId ?? null,
            // Marks the deferred setup (cover image + research agent) as still
            // owed; cleared by runDeferredSelfServiceProjectSetup on success.
            selfServiceSetupPendingAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!newProject) {
          throw new Error("Failed to create project");
        }

        // User is always Owner of their own project
        await tx.insert(projectUsers).values({
          userId: newUser.id,
          projectId: newProject.id,
          role: MemberRole.OWNER,
        });

        return { targetOrg, targetOffice, newProject };
      } catch (txError) {
        console.error(
          "[createUserWithOrganization] Transaction error:",
          txError,
        );
        throw txError; // Re-throw to trigger rollback
      }
    });

    const { targetOrg, targetOffice, newProject } = result;

    // No billing gate here by design: this is the signup flow creating the
    // FIRST project in a brand-new personal org, always within the Starter
    // active-project limit.
    //
    // Self-service users skip the onboarding plan step entirely (their magic
    // link carries an explicit redirectTo into the project chat), so stamp the
    // Starter plan on the fresh personal org here — otherwise their first
    // plain login would bounce them to /setup/plan. Non-fatal: an unstamped
    // org still resolves to Starter and the plan step catches it later.
    if (isBillingPackageEnabled()) {
      try {
        await activateStarterPlan(targetOrg.id);
      } catch (billingError) {
        console.error(
          `[Self-Service] Starter plan activation failed for org ${targetOrg.id}:`,
          billingError,
        );
      }
    }

    // Create initial chat for the project (matches the Hono projects route pattern)
    const initialChatId = crypto.randomUUID();
    await saveChat({
      id: initialChatId,
      userId: newUser.id,
      title: newProject.name,
      projectId: newProject.id,
      isInitial: true,
    });

    // Cover image generation and the research agent bootstrap are deferred to
    // the user's first magic-link verification (email ownership proven) — see
    // runDeferredSelfServiceProjectSetup. Running them here would let
    // unverified signups burn AI budget.

    // The project always lands in the user's PERSONAL workspace and stays there.
    // A gov org/office (validated.organizationId/officeId) selected on the
    // landing page is NOT submitted to at signup — it is only a default the user
    // can later submit to explicitly. So the redirect is always the personal
    // workspace location.
    const redirectLocation = {
      organizationSlug: targetOrg.slug,
      officeSlug: targetOffice.slug,
      projectSlug: newProject.slug,
    };

    // Build redirect URL to the new project chat
    const redirectTo = buildProjectChatUrl(
      redirectLocation.organizationSlug,
      redirectLocation.officeSlug,
      redirectLocation.projectSlug,
      {
        chatId: initialChatId,
        initialMessageContent: validated.projectDescription,
      },
    );

    // Generate verification token and send magic link email with redirect
    const token = await createVerificationToken(
      newUser.id,
      "email_verification",
    );
    // newProject.id still rides along for backward compatibility, but the
    // deferred setup (cover image + research agent) is driven by the
    // selfServiceSetupPendingAt flag stamped on the project above — see
    // runPendingSelfServiceProjectSetups.
    const magicLinkUrl = buildMagicLinkUrl(
      newUser.id,
      token,
      "verification",
      redirectTo,
      newProject.id,
    );

    const emailResult = await sendMagicLinkEmail({
      to: validated.email,
      magicLinkUrl,
      type: "verification",
    });

    if (!emailResult.success) {
      console.error(
        "[Self-Service] Failed to send verification email:",
        emailResult.error,
      );
      return { status: "failed", error: "Failed to send verification email" };
    }

    // Return email_sent status - user needs to verify email before accessing the app
    return {
      status: "email_sent",
      email: validated.email,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        "[createUserWithOrganization] Validation error:",
        error.issues,
      );
      return {
        status: "invalid_data",
        error: error.issues
          .map((e: { message: string }) => e.message)
          .join(", "),
      };
    }

    console.error("[createUserWithOrganization] Failed:", error);
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}
