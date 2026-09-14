"use server";

import { z } from "zod";

import {
  createProfile,
  getProfileByUserId,
  updateProfile,
} from "@wildfires-org/turboplan-db/queries";

import {
  ensureOrganizationViewerMembership,
  isRoleUpgradeAllowed,
  resolveAffiliation,
} from "@/lib/affiliation-detection";
import { FormStatus } from "@/lib/form-status";
import { captureServerEvent } from "@/lib/server-analytics";
import { auth } from "../auth";

const setupSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
});

export interface SetupState {
  status: FormStatus;
}

export const completeSetup = async (
  _: SetupState,
  formData: FormData,
): Promise<SetupState> => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: FormStatus.FAILED };
    }

    const validatedData = setupSchema.parse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
    });

    // Role is detected automatically from the user's email domain — there is no
    // manual selection. A matching government organization makes the user a
    // government worker, a matching environmental-planning firm makes them an
    // environmental planner; everyone else is a citizen.
    const { role: detectedRole, org: affiliatedOrg } = await resolveAffiliation(
      session.user.email,
    );

    const existingProfile = await getProfileByUserId(session.user.id);
    // Captured BEFORE the write so we can tell a first completion from a later
    // edit of the same form.
    const wasAlreadyComplete = Boolean(
      existingProfile?.firstName?.trim() && existingProfile?.lastName?.trim(),
    );

    if (existingProfile) {
      // Upgrade-only: never let setup overwrite an already-elevated role. Write
      // userRole only when the existing profile has no role yet or is a plain
      // citizen (see isRoleUpgradeAllowed). This keeps an environmental-planner
      // email match from clobbering a government_agency role granted elsewhere
      // (e.g. via syncAffiliation) — an elevated → elevated flip.
      const shouldUpdateRole = isRoleUpgradeAllowed(existingProfile.userRole);

      await updateProfile({
        userId: session.user.id,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        ...(shouldUpdateRole && { userRole: detectedRole }),
      });
    } else {
      // Brand-new profile: the detected role is the source of truth.
      await createProfile({
        userId: session.user.id,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        userRole: detectedRole,
      });
    }

    // Detected government/environmental-planning users are auto-added to the
    // matched org as a viewer (never a billable owner/editor seat).
    if (affiliatedOrg) {
      await ensureOrganizationViewerMembership(
        session.user.id,
        affiliatedOrg.id,
      );
    }

    // The profile step is the only onboarding step every install runs — the
    // plan step that follows is skipped entirely when billing is disabled — so
    // this is where the funnel ends. Fired only on the incomplete -> complete
    // transition, so a user editing their name later does not re-enter it.
    if (!wasAlreadyComplete) {
      captureServerEvent(session.user.id, "onboarding_completed", {
        affiliated_organization_id: affiliatedOrg?.id,
      });
    }

    return { status: FormStatus.SUCCESS };
  } catch (error) {
    console.error("Setup error:", error);
    if (error instanceof z.ZodError) {
      return { status: FormStatus.INVALID_DATA };
    }
    return { status: FormStatus.FAILED };
  }
};
