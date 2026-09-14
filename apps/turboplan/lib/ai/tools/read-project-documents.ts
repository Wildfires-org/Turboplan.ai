import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  getProjectDocumentsByIds,
  getProjectDocumentsByProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { extractDocumentText } from "@wildfires-org/turboplan-documents/server";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

/**
 * Total character budget shared across all documents read in a single call.
 * Once exhausted, remaining documents are reported as skipped so the model
 * can decide whether to request fewer/other documents.
 */
const TOTAL_CHAR_BUDGET = 120_000;

/**
 * Maximum number of documents extracted in a single call. Caps the fan-out of
 * parallel downloads/extractions; records beyond the cap are reported as
 * skipped so the model can request them in a follow-up call.
 */
const MAX_DOCUMENTS_PER_CALL = 10;

/**
 * Upper bound on requested ids per call. Generous enough that the graceful
 * "too-many-documents" skip reporting still applies, while keeping the
 * pre-cap DB lookup bounded.
 */
const MAX_REQUESTED_DOCUMENT_IDS = 100;

/**
 * How many documents are downloaded/extracted at once. Each fetch can buffer
 * up to 50MB, so this bounds peak memory per tool call (~150MB) instead of a
 * full MAX_DOCUMENTS_PER_CALL-wide fan-out (~500MB).
 */
const EXTRACTION_CONCURRENCY = 3;

interface ReadProjectDocumentsProps {
  projectId: string;
  userId: string;
}

type SkippedEntry = {
  id?: string;
  filename?: string;
  reason: string;
  message?: string;
};

type ReadDocument = {
  id: string;
  filename: string;
  text: string;
  truncated: boolean;
};

export const readProjectDocuments = async ({
  projectId,
  userId,
}: ReadProjectDocumentsProps) => {
  const description = await getPrompt("tool-desc-read-project-documents");

  return tool({
    description,
    inputSchema: z.object({
      documentIds: z
        .array(z.string().uuid())
        .max(MAX_REQUESTED_DOCUMENT_IDS)
        .optional(),
    }),
    execute: async ({ documentIds }) => {
      // Re-assert READ permission at execution time — activeTools gating is a
      // convenience, this is the authoritative check before reading.
      const rbac = getRBACService();
      const permission = await rbac.checkPermission(
        userId,
        projectId,
        EntityType.PROJECT,
        Action.READ,
      );
      if (!permission.allowed) {
        return { error: "Access denied." };
      }

      // Dedupe — a repeated id must not consume extra extraction slots or
      // duplicate the document in the output.
      const requestedIds = [...new Set(documentIds ?? [])];

      // Fetch by ids when provided, otherwise every document in the project.
      const records =
        requestedIds.length > 0
          ? await getProjectDocumentsByIds(requestedIds)
          : await getProjectDocumentsByProjectId(projectId);

      const skipped: SkippedEntry[] = [];

      // SECURITY: only keep documents that belong to THIS project. Any id that
      // does not resolve to a document in this project is reported as
      // "not-found" — never reveal that it exists in another project.
      const accessible = records.filter(
        (record) => record.projectId === projectId,
      );

      // Report requested ids that did not resolve to an accessible document.
      if (requestedIds.length > 0) {
        const accessibleIds = new Set(accessible.map((record) => record.id));
        for (const id of requestedIds) {
          if (!accessibleIds.has(id)) {
            skipped.push({ id, reason: "not-found" });
          }
        }
      }

      // Process in a deterministic order so the budget is applied predictably.
      // When explicit ids are given, honor the caller's ordering; otherwise use
      // the query order (newest first).
      const orderedRecords: typeof accessible = [];
      if (requestedIds.length > 0) {
        for (const id of requestedIds) {
          const match = accessible.find((record) => record.id === id);
          if (match) {
            orderedRecords.push(match);
          }
        }
      } else {
        orderedRecords.push(...accessible);
      }

      // Cap the number of documents extracted per call. Records beyond the cap
      // are reported as skipped with reason "too-many-documents" so the model
      // can request them in a follow-up call, keeping the parallel download
      // fan-out bounded.
      const cappedRecords = orderedRecords.slice(0, MAX_DOCUMENTS_PER_CALL);
      for (const record of orderedRecords.slice(MAX_DOCUMENTS_PER_CALL)) {
        skipped.push({
          id: record.id,
          filename: record.originalFilename,
          reason: "too-many-documents",
        });
      }

      // Extract in small batches — each fetch can buffer up to 50MB, so a
      // full 10-wide fan-out could hold ~500MB at once. The total budget is
      // then applied sequentially in the deterministic order above.
      const extractions: Awaited<ReturnType<typeof extractDocumentText>>[] = [];
      for (let i = 0; i < cappedRecords.length; i += EXTRACTION_CONCURRENCY) {
        const batch = cappedRecords.slice(i, i + EXTRACTION_CONCURRENCY);
        extractions.push(
          ...(await Promise.all(
            batch.map((record) =>
              extractDocumentText({
                url: record.url,
                mimeType: record.mimeType,
              }),
            ),
          )),
        );
      }

      const documents: ReadDocument[] = [];
      let remainingBudget = TOTAL_CHAR_BUDGET;

      cappedRecords.forEach((record, index) => {
        const result = extractions[index];

        if (!result.ok) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: result.reason,
            message: result.message,
          });
          return;
        }

        if (remainingBudget <= 0) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "budget-exceeded",
          });
          return;
        }

        const withinBudget = result.text.slice(0, remainingBudget);
        const budgetTruncated = withinBudget.length < result.text.length;
        remainingBudget -= withinBudget.length;

        documents.push({
          id: record.id,
          filename: record.originalFilename,
          text: withinBudget,
          truncated: result.truncated || budgetTruncated,
        });
      });

      return {
        documents,
        skipped,
        totalDocuments: orderedRecords.length,
      };
    },
  });
};
