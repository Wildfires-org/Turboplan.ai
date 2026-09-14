import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  type CatalogerEntry,
  type CatalogerRun,
  catalogerEntry,
  catalogerRun,
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

export const getCatalogerRunsByUserId = async (
  userId: string,
): Promise<CatalogerRun[]> => {
  return db
    .select()
    .from(catalogerRun)
    .where(eq(catalogerRun.userId, userId))
    .orderBy(desc(catalogerRun.createdAt));
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
