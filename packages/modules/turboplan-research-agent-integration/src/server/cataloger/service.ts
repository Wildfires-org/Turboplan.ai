import { randomUUID } from "crypto";
import type { z } from "zod";

import { autoGenerateTemplateCoverImage } from "@wildfires-org/turboplan-ai/server";
import { OrganizationType } from "@wildfires-org/turboplan-db";
import { isUniqueViolation } from "@wildfires-org/turboplan-db/db-client";
import { createProjectDocument } from "@wildfires-org/turboplan-db/queries";
import type {
  CatalogerEntry,
  CatalogerRun,
} from "@wildfires-org/turboplan-db/schemas";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import { uploadFile } from "@wildfires-org/turboplan-upload/server";
import {
  assignOrganizationOwner,
  createOffice,
  createOrganization,
  createProject,
  generateUniqueProjectSlug,
  getOfficeByName,
  getOrganizationByName,
} from "@wildfires-org/turboplan-workspace/server";

import type { MilestoneSaveItem } from "../../types";
import { getResearchAgentClient } from "../external-client";
import { insertMilestonesWithTasks, insertProjectFields } from "../repository";
import type { catalogerCreateEntrySchema } from "../schemas";
import {
  createCatalogerEntry as createCatalogerEntryRecord,
  getNonTerminalCatalogerRuns,
  updateCatalogerRunExternalId,
  updateCatalogerRunStatus,
} from "./repository";

// ---------------------------------------------------------------------------
// Start cataloger run (fire-and-forget)
// ---------------------------------------------------------------------------

export const startCatalogerRun = async ({
  runId,
  message,
  webhookSecret,
}: {
  runId: string;
  message: string;
  webhookSecret: string;
}): Promise<void> => {
  try {
    const client = getResearchAgentClient();

    const { data, error } = await client.startRun({
      prompt: message,
      skill: "project-cataloger",
      webhookSecret,
    });

    if (error || !data) {
      console.error("[cataloger] Failed to start external service:", error);
      await updateCatalogerRunStatus({
        runId,
        status: "failed",
        currentStep: "Failed to start cataloger agent",
      });
      return;
    }

    await updateCatalogerRunExternalId({ runId, externalRunId: data.runId });
    await updateCatalogerRunStatus({
      runId,
      status: "running",
      currentStep: "Cataloger agent started...",
    });
  } catch (error) {
    console.error(
      "[cataloger] Unexpected error starting external service:",
      error,
    );
    await updateCatalogerRunStatus({
      runId,
      status: "failed",
      currentStep: "Failed to start cataloger agent",
    }).catch((e) =>
      console.error("[cataloger] Failed to update status to failed:", e),
    );
  }
};

// ---------------------------------------------------------------------------
// Reconcile external status
// ---------------------------------------------------------------------------

/**
 * If the external agent finished but our DB still shows "active",
 * reconcile the DB and return the updated status/step.
 * Returns null when no reconciliation was needed.
 */
export const reconcileCatalogerExternalStatus = async (
  runId: string,
  externalRunId: string,
): Promise<{ status: string; currentStep: string } | null> => {
  try {
    const client = getResearchAgentClient();
    const { data: externalStatus } = await client.getRunStatus(externalRunId);

    if (!externalStatus) {
      return null;
    }

    const isExternalDone =
      externalStatus.status === "completed" ||
      externalStatus.status === "failed" ||
      externalStatus.status === "cancelled";

    if (!isExternalDone) {
      return null;
    }

    const reconciledStatus =
      externalStatus.status === "completed" ? "completed" : "failed";

    const reconciledStep =
      externalStatus.status === "completed"
        ? "Cataloger complete"
        : `Agent ${externalStatus.status}: ${externalStatus.lastError ?? "unknown error"}`;

    await updateCatalogerRunStatus({
      runId,
      status: reconciledStatus,
      currentStep: reconciledStep,
    });

    return { status: reconciledStatus, currentStep: reconciledStep };
  } catch (error) {
    console.error("[cataloger] Failed to check external status:", error);
    return null;
  }
};

/**
 * Reconcile non-terminal runs with the external service by run IDs.
 * Fetches the runs from the DB, filters to non-terminal with an externalRunId,
 * and caps concurrent external API calls to `limit`.
 *
 * Returns a map of runId → updated { status, currentStep } for runs that changed.
 */
export const reconcileCatalogerRunStatus = async (
  runIds: string[],
  limit = 10,
): Promise<Map<string, { status: string; currentStep: string }>> => {
  const reconciled = new Map<string, { status: string; currentStep: string }>();

  if (runIds.length === 0) {
    return reconciled;
  }

  const eligible = await getNonTerminalCatalogerRuns(runIds, limit);
  const withExternalId = eligible.filter((r) => r.externalRunId);

  if (withExternalId.length === 0) {
    return reconciled;
  }

  const results = await Promise.allSettled(
    withExternalId.map(async (r) => {
      const result = await reconcileCatalogerExternalStatus(
        r.id,
        r.externalRunId!,
      );
      if (result) {
        reconciled.set(r.id, result);
      }
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[cataloger] Reconciliation error:", result.reason);
    }
  }

  return reconciled;
};

// ---------------------------------------------------------------------------
// Find-or-create helpers (for webhook entry creation)
// ---------------------------------------------------------------------------

export const findOrCreateOrganization = async (
  name: string,
  userId: string,
): Promise<{ id: string; created: boolean }> => {
  // Try to find existing org by name (case-insensitive)
  const existing = await getOrganizationByName(name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create new org + assign user as owner
  try {
    const newOrg = await createOrganization({
      name,
      type: OrganizationType.GOVERNMENT,
      createdBy: userId,
    });
    await assignOrganizationOwner(userId, newOrg.id);
    return { id: newOrg.id, created: true };
  } catch (error: unknown) {
    // Handle race condition: another concurrent webhook may have created the same org
    if (isUniqueViolation(error)) {
      const retried = await getOrganizationByName(name);
      if (retried) {
        return { id: retried.id, created: false };
      }
    }
    throw error;
  }
};

export const findOrCreateOffice = async (
  name: string,
  organizationId: string,
  userId: string,
): Promise<{ id: string; created: boolean }> => {
  // Try to find existing office by name (case-insensitive)
  const existing = await getOfficeByName(name, organizationId);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create new office (createOffice auto-assigns creator as owner)
  try {
    const newOffice = await createOffice({
      name,
      organizationId,
      createdBy: userId,
    });
    return { id: newOffice.id, created: true };
  } catch (error: unknown) {
    // Handle race condition: another concurrent webhook may have created the same office
    if (isUniqueViolation(error)) {
      const retried = await getOfficeByName(name, organizationId);
      if (retried) {
        return { id: retried.id, created: false };
      }
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Create a full catalog entry (org → office → project → docs/milestones/fields)
// ---------------------------------------------------------------------------

const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

const processDocument = async (
  doc: { url: string; title: string; relevance: number; context: string },
  projectId: string,
  catalogerRun: CatalogerRun,
): Promise<void> => {
  // URLs come from the research agent which only serves files from government websites,
  // so we trust them. HTTPS check is a basic sanity guard, not a full SSRF mitigation.
  if (!doc.url.startsWith("https://")) {
    console.error(`[cataloger] Blocked non-HTTPS URL: ${doc.url}`);
    return;
  }

  const response = await fetch(doc.url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.error(`[cataloger] Failed to fetch ${doc.url}: ${response.status}`);
    return;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_DOCUMENT_SIZE) {
    console.error(`[cataloger] Skipping ${doc.url}: exceeds 50MB limit`);
    return;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_DOCUMENT_SIZE) {
    console.error(
      `[cataloger] Skipping ${doc.url}: downloaded size exceeds 50MB limit`,
    );
    return;
  }

  const contentType = response.headers.get("content-type") || "application/pdf";
  const size = buffer.byteLength;

  const urlPath = new URL(doc.url).pathname;
  const originalFilename =
    decodeURIComponent(urlPath.split("/").pop() || "") || `${doc.title}.pdf`;
  const ext = originalFilename.includes(".")
    ? ""
    : contentType.includes("word")
      ? ".docx"
      : ".pdf";
  const filename = `cataloger/${projectId}/${Date.now()}-${originalFilename}${ext}`;

  const { url: blobUrl } = await uploadFile(filename, buffer, contentType);

  await createProjectDocument({
    projectId,
    userId: catalogerRun.userId,
    filename: filename.split("/").pop() || originalFilename,
    originalFilename,
    mimeType: contentType,
    size,
    url: blobUrl,
    source: "research",
    relevance: doc.relevance,
    context: doc.context,
  });
};

export const createCatalogEntry = async (
  entry: z.infer<typeof catalogerCreateEntrySchema>,
  catalogerRun: CatalogerRun,
): Promise<CatalogerEntry> => {
  // 1. Find or create the organization (throws on failure)
  const { id: organizationId } = await findOrCreateOrganization(
    entry.organization.name,
    catalogerRun.userId,
  );

  // 2. Find or create the office (throws on failure)
  const { id: officeId } = await findOrCreateOffice(
    entry.office.name,
    organizationId,
    catalogerRun.userId,
  );

  // 3. Create a template project (throws on failure)
  const slug = await generateUniqueProjectSlug(officeId, entry.name);
  const project = await createProject({
    name: entry.name,
    slug,
    description: entry.description,
    prompt: entry.prompt,
    officeId,
    createdBy: catalogerRun.userId,
    isTemplate: true,
    isPublic: true,
  });
  const projectId = project.id;

  // 4. Save documents (partial failure OK, parallelized in chunks)
  const MAX_PARALLEL_DOWNLOADS = 5;
  for (let i = 0; i < entry.documents.length; i += MAX_PARALLEL_DOWNLOADS) {
    const chunk = entry.documents.slice(i, i + MAX_PARALLEL_DOWNLOADS);
    await Promise.allSettled(
      chunk.map((doc) => processDocument(doc, projectId, catalogerRun)),
    );
  }

  // 5. Save milestones (partial failure OK)
  try {
    if (entry.milestones.length > 0) {
      const milestoneSaveItems: MilestoneSaveItem[] = entry.milestones.map(
        (m, index) => ({
          artifactId: randomUUID(),
          title: m.title,
          startDate: m.startDate,
          dueDate: m.dueDate,
          sourceIndex: index,
          tasks: m.tasks.map((t, taskIndex) => ({
            artifactId: randomUUID(),
            title: t.title,
            description: t.description,
            startDate: t.startDate,
            dueDate: t.dueDate,
            dependencies: t.dependencies,
            sourceIndex: taskIndex,
          })),
        }),
      );

      await insertMilestonesWithTasks(
        projectId,
        entry.name,
        milestoneSaveItems,
        catalogerRun.userId,
      );
    }
  } catch (err) {
    console.warn("[cataloger] Failed to save milestones:", err);
  }

  // 6. Save fields (partial failure OK)
  try {
    if (entry.fields.length > 0) {
      await insertProjectFields(projectId, entry.fields);
    }
  } catch (err) {
    console.warn("[cataloger] Failed to save fields:", err);
  }

  // 7. Save timeline records (partial failure OK)
  if (entry.timeline.length > 0) {
    await Promise.allSettled(
      entry.timeline.map((item) =>
        createTimelineRecord({
          projectId,
          userId: catalogerRun.userId,
          entityType: "project",
          entityId: projectId,
          entityName: entry.name,
          action: "created",
          title: item.title,
          description: item.description,
          isPublic: true,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          resourceUrls: item.resourceUrls,
          metadata: item.metadata,
        }),
      ),
    );
  }

  // 8. Cover image generation. Awaited (not fire-and-forget) so it runs to
  // completion inside this cataloger task's request-scoped DB connection and
  // waitUntil window — an unawaited call gets reaped when the task returns and
  // the connection closes. This whole task already runs in the background, so
  // awaiting here blocks no user-facing response. The call never throws.
  if (entry.coverImagePrompt || entry.description) {
    await autoGenerateTemplateCoverImage(
      projectId,
      entry.name,
      catalogerRun.userId,
      entry.coverImagePrompt || entry.description,
    ).catch((err) => {
      console.warn("[cataloger] Cover image generation failed:", err);
    });
  }

  // 9. Record the cataloger entry
  const catalogerEntryRecord = await createCatalogerEntryRecord({
    catalogerRunId: catalogerRun.id,
    projectId,
    organizationId,
    officeId,
    name: entry.name,
    rawData: entry.rawData,
  });

  return catalogerEntryRecord;
};
