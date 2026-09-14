import { and, asc, eq } from "drizzle-orm";

import {
  type Office,
  OfficeStatus,
  type Organization,
  OrganizationStatus,
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { MemberRole } from "@wildfires-org/turboplan-rbac";
import { generateUniqueSlug } from "@wildfires-org/turboplan-utils/server";

import { getOfficesByOrganization } from "../offices/queries";

interface PersonalWorkspace {
  organization: Organization;
  office: Office;
}

/**
 * Resolve (or lazily create) the citizen's PERSONAL workspace — the personal
 * organization plus a default office the citizen owns. Used as the creation
 * target for landing-page projects, which are always created as DRAFTs in the
 * citizen's own org before being submitted to a government org for review.
 *
 * A personal org is one with `type = "personal"` AND `createdBy = userId`. When
 * several exist, the OLDEST is reused (createdAt ASC) so we always land on the
 * same canonical workspace; one is created if none exists.
 */
export const getOrCreatePersonalWorkspace = async (
  userId: string,
  email?: string,
): Promise<PersonalWorkspace> => {
  const [existingOrg] = await db
    .select()
    .from(organization)
    .where(
      and(
        eq(organization.type, OrganizationType.PERSONAL),
        eq(organization.createdBy, userId),
      ),
    )
    .orderBy(asc(organization.createdAt))
    .limit(1);

  const now = new Date();

  let personalOrg = existingOrg;

  if (!personalOrg) {
    const emailPrefix = email?.split("@")[0] ?? "user";
    const orgName = `${emailPrefix}'s Organization`;
    const orgSlug = generateUniqueSlug(orgName);

    const [newOrg] = await db
      .insert(organization)
      .values({
        slug: orgSlug,
        name: orgName,
        description: email
          ? `Personal organization for ${email}`
          : "Personal organization",
        type: OrganizationType.PERSONAL,
        status: OrganizationStatus.ACTIVE,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newOrg) {
      throw new Error("Failed to create personal organization");
    }

    await db.insert(organizationUsers).values({
      userId,
      organizationId: newOrg.id,
      role: MemberRole.OWNER,
    });

    personalOrg = newOrg;
  }

  // Reuse the oldest office in the personal org; create a default one if none.
  const [existingOffice] = await getOfficesByOrganization(personalOrg.id, {
    sortOrder: "asc",
    limit: 1,
  });

  let personalOffice = existingOffice;

  if (!personalOffice) {
    const officeName = "My Projects";
    const officeSlug = generateUniqueSlug(officeName);

    const [newOffice] = await db
      .insert(office)
      .values({
        name: officeName,
        slug: officeSlug,
        description: "Your personal office",
        organizationId: personalOrg.id,
        createdBy: userId,
        status: OfficeStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newOffice) {
      throw new Error("Failed to create personal office");
    }

    await db.insert(officeUsers).values({
      userId,
      officeId: newOffice.id,
      role: MemberRole.OWNER,
    });

    personalOffice = newOffice;
  }

  return { organization: personalOrg, office: personalOffice };
};
