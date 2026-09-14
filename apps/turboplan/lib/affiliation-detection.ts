import "server-only";

import {
  OrganizationType,
  organizationUsers,
  UserRole,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  getActiveOrganizationsWithEmailDomains,
  getProfileByUserId,
  type OrganizationWithEmailDomains,
  updateProfile,
} from "@wildfires-org/turboplan-db/queries";
import { emailMatchesDomains } from "@wildfires-org/turboplan-utils/server";

/**
 * A user's affiliation (and therefore their role) is derived entirely from their
 * email domain: an email whose domain matches the configured `emailDomains` of
 * an active organization affiliates the user with that organization. There is no
 * manual role selection anywhere in the product.
 *
 * Two organization types participate in this detection:
 * - `government` organizations grant the `government_agency` role.
 * - `environmental_planner` firms grant the `environmental_planning` role.
 *
 * A detected user is also auto-added to the matched organization as a `viewer`
 * — never owner/editor — so they get read access without consuming a billable
 * seat.
 */

export interface Affiliation {
  role: UserRole;
  /** The matched organization, or null when the user has no affiliation. */
  org: OrganizationWithEmailDomains | null;
}

/**
 * Find the active organization whose configured email domains match the given
 * email, or null when none match.
 *
 * When an email matches more than one organization, a `government` organization
 * always wins over an `environmental_planner` one (government affiliation is the
 * stronger claim); otherwise the first match wins.
 */
export async function findAffiliatedOrgForEmail(
  email: string | null | undefined,
): Promise<OrganizationWithEmailDomains | null> {
  if (!email) {
    return null;
  }

  const orgs = await getActiveOrganizationsWithEmailDomains();
  const matches = orgs.filter((org) =>
    emailMatchesDomains(email, org.emailDomains),
  );

  if (matches.length === 0) {
    return null;
  }

  const governmentMatch = matches.find(
    (org) => org.type === OrganizationType.GOVERNMENT,
  );
  return governmentMatch ?? matches[0];
}

/**
 * Resolve both the role and the matched organization for an email in a single
 * lookup. A government match yields `government_agency`, an
 * environmental-planner match yields `environmental_planning`, and no match
 * yields `citizen` + null.
 */
export async function resolveAffiliation(
  email: string | null | undefined,
): Promise<Affiliation> {
  const org = await findAffiliatedOrgForEmail(email);
  if (!org) {
    return { role: UserRole.CITIZEN, org: null };
  }

  const role =
    org.type === OrganizationType.GOVERNMENT
      ? UserRole.GOVERNMENT_AGENCY
      : UserRole.ENVIRONMENTAL_PLANNING;

  return { role, org };
}

/**
 * Ensure the user is at least a `viewer` member of the organization.
 *
 * Idempotent and non-destructive: if the user is already a member (any role,
 * including owner/editor) nothing changes. We intentionally only ever grant
 * `viewer` here — billable roles (owner/editor) are assigned through explicit
 * flows, not by email-domain detection.
 */
export async function ensureOrganizationViewerMembership(
  userId: string,
  organizationId: string,
): Promise<void> {
  await db
    .insert(organizationUsers)
    .values({ userId, organizationId, role: "viewer" })
    .onConflictDoNothing();
}

/**
 * Upgrade-only role predicate shared by `syncAffiliation` and the setup server
 * action. A detected elevated role may only be written when the user currently
 * has no role or is a plain `citizen` — never over an already-elevated role.
 * This prevents an environmental-planner email match from silently
 * reclassifying a `government_agency` user (elevated → elevated flip) and
 * prevents any downgrade.
 */
export const isRoleUpgradeAllowed = (
  currentRole: UserRole | null | undefined,
): boolean =>
  currentRole === null ||
  currentRole === undefined ||
  currentRole === UserRole.CITIZEN;

/**
 * Re-evaluate an existing user's affiliation and, when their email matches a
 * participating organization, upgrade their role and add them as a `viewer`
 * member of that org.
 *
 * This is intentionally UPGRADE-ONLY: the role is changed only when the current
 * role is missing or `citizen`. It never flips a user between elevated roles
 * (e.g. government_agency ↔ environmental_planning) and never downgrades, so no
 * one loses access or is silently reclassified. Viewer membership of the matched
 * org is always ensured. Handles the "a domain was added after the account
 * existed" case on the user's next login.
 */
export async function syncAffiliation(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const { role, org } = await resolveAffiliation(email);
  if (!org) {
    return;
  }

  // Upgrade-only: only write a role when the user currently has none or is a
  // citizen (see isRoleUpgradeAllowed). A user already holding an elevated role
  // is never flipped to another elevated role and never downgraded.
  const profile = await getProfileByUserId(userId);
  if (isRoleUpgradeAllowed(profile?.userRole)) {
    await updateProfile({ userId, userRole: role });
  }

  await ensureOrganizationViewerMembership(userId, org.id);
}
