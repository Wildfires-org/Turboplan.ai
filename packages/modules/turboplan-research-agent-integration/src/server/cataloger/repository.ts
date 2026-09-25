import {
  and,
  eq,
  inArray,
  isNotNull,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  type CatalogerEntry,
  type CatalogerRun,
  catalogerEntry,
  catalogerRun,
  type Office,
  type Organization,
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  ResearchAgentChatStatus,
} from "@wildfires-org/turboplan-db/schemas";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createCatalogerRun = async ({
  userId,
  message,
  webhookSecret,
}: {
  userId: string;
  message: string;
  webhookSecret: string;
}): Promise<CatalogerRun> => {
  const now = new Date();
  const [record] = await db
    .insert(catalogerRun)
    .values({
      userId,
      message,
      webhookSecret,
      status: "initializing",
      entriesCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return record;
};

export const createCatalogerEntry = async ({
  catalogerRunId,
  projectId,
  organizationId,
  officeId,
  name,
  rawData,
}: {
  catalogerRunId: string;
  projectId?: string;
  organizationId?: string;
  officeId?: string;
  name: string;
  rawData?: unknown;
}): Promise<CatalogerEntry> => {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .insert(catalogerEntry)
      .values({
        catalogerRunId,
        projectId,
        organizationId,
        officeId,
        name,
        rawData,
        createdAt: new Date(),
      })
      .returning();

    await tx
      .update(catalogerRun)
      .set({
        entriesCount: sql`${catalogerRun.entriesCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(catalogerRun.id, catalogerRunId));

    return record;
  });
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export const getCatalogerRunById = async (
  id: string,
): Promise<CatalogerRun | null> => {
  const [record] = await db
    .select()
    .from(catalogerRun)
    .where(eq(catalogerRun.id, id))
    .limit(1);
  return record ?? null;
};

export const getCatalogerRunByWebhookSecret = async (
  secret: string,
): Promise<CatalogerRun | null> => {
  const [record] = await db
    .select()
    .from(catalogerRun)
    .where(
      and(
        eq(catalogerRun.webhookSecret, secret),
        // Mirrors getResearchAgentChatByWebhookSecret: never authenticate the
        // "legacy" sentinel, and stop honoring a run's secret once the run is
        // terminal so completed/cancelled runs cannot be written to forever.
        ne(catalogerRun.webhookSecret, LEGACY_WEBHOOK_SECRET),
        notInArray(catalogerRun.status, TERMINAL_STATUSES),
      ),
    )
    .limit(1);
  return record ?? null;
};

const LEGACY_WEBHOOK_SECRET = "legacy";

const TERMINAL_STATUSES = [
  ResearchAgentChatStatus.COMPLETED,
  ResearchAgentChatStatus.FAILED,
  ResearchAgentChatStatus.CANCELLED,
];

export const getNonTerminalCatalogerRuns = async (
  runIds: string[],
  limit: number,
): Promise<CatalogerRun[]> => {
  return db
    .select()
    .from(catalogerRun)
    .where(
      and(
        inArray(catalogerRun.id, runIds),
        notInArray(catalogerRun.status, TERMINAL_STATUSES),
      ),
    )
    .limit(limit);
};

/**
 * Find a non-personal organization with this name (case-insensitive) that the
 * user owns through a DIRECT membership row. Deliberately not an RBAC check:
 * the resolver grants platform admins every permission, so it would let a
 * cataloger run attach output to any tenant's organization.
 */
export const getOwnedOrganizationByName = async (
  name: string,
  userId: string,
): Promise<Organization | null> => {
  const [result] = await db
    .select({ organization })
    .from(organization)
    .innerJoin(
      organizationUsers,
      and(
        eq(organizationUsers.organizationId, organization.id),
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.role, "owner"),
      ),
    )
    .where(
      and(
        sql`LOWER(${organization.name}) = LOWER(${name})`,
        ne(organization.type, OrganizationType.PERSONAL),
      ),
    )
    .limit(1);
  return result?.organization ?? null;
};

/**
 * Find an office with this name (case-insensitive) inside the organization
 * that the user owns directly — either as office owner or as owner of the
 * parent organization. Same no-admin-bypass reasoning as above.
 */
export const getOwnedOfficeByName = async (
  name: string,
  organizationId: string,
  userId: string,
): Promise<Office | null> => {
  const [result] = await db
    .select({ office })
    .from(office)
    .leftJoin(
      officeUsers,
      and(
        eq(officeUsers.officeId, office.id),
        eq(officeUsers.userId, userId),
        eq(officeUsers.role, "owner"),
      ),
    )
    .leftJoin(
      organizationUsers,
      and(
        eq(organizationUsers.organizationId, office.organizationId),
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.role, "owner"),
      ),
    )
    .where(
      and(
        eq(office.organizationId, organizationId),
        sql`LOWER(${office.name}) = LOWER(${name})`,
        or(isNotNull(officeUsers.userId), isNotNull(organizationUsers.userId)),
      ),
    )
    .limit(1);
  return result?.office ?? null;
};

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateCatalogerRunExternalId = async ({
  runId,
  externalRunId,
}: {
  runId: string;
  externalRunId: string;
}): Promise<CatalogerRun | null> => {
  const [record] = await db
    .update(catalogerRun)
    .set({
      externalRunId,
      updatedAt: new Date(),
    })
    .where(eq(catalogerRun.id, runId))
    .returning();
  return record ?? null;
};

export const updateCatalogerRunStatus = async ({
  runId,
  status,
  currentStep,
}: {
  runId: string;
  status: string;
  currentStep?: string;
}): Promise<CatalogerRun | null> => {
  const updateData: Partial<CatalogerRun> = {
    status,
    updatedAt: new Date(),
  };

  if (currentStep !== undefined) {
    updateData.currentStep = currentStep;
  }

  const [record] = await db
    .update(catalogerRun)
    .set(updateData)
    .where(eq(catalogerRun.id, runId))
    .returning();

  return record ?? null;
};
