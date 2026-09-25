import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  getProjectDocumentExtractionByIds,
  getProjectDocumentsByProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

/**
 * Reads the text of a project's uploaded documents.
 *
 * Text is NOT extracted here. Documents are extracted asynchronously by the
 * research-agent service, which polls rows with `extraction_status = 'pending'`
 * and writes `extracted_text` (or marks the row failed/unsupported). This tool
 * only reads what is already stored, so the chat Worker never downloads or
 * parses a document and its memory use stays bounded by the character budget
 * below. Documents whose extraction has not finished are reported as skipped
 * with reason "extraction-pending".
 */

/**
 * Total character budget shared across all documents read in a single call.
 * Once exhausted, remaining documents are reported as skipped so the model
 * can decide whether to request fewer/other documents.
 */
const TOTAL_CHAR_BUDGET = 120_000;

/**
 * Maximum number of documents returned in a single call. Records beyond the
 * cap are reported as skipped so the model can request them in a follow-up
 * call, keeping the response size bounded.
 */
const MAX_DOCUMENTS_PER_CALL = 10;

/**
 * Upper bound on requested ids per call. Generous enough that the graceful
 * "too-many-documents" skip reporting still applies, while keeping the
 * pre-cap DB lookup bounded.
 */
const MAX_REQUESTED_DOCUMENT_IDS = 100;

/**
 * Mirrors `MAX_EXTRACTED_CHARS` in
 * `@wildfires-org/turboplan-document-extraction` — the cap the extractor
 * applies when it stores `extracted_text`. The stored row does not record
 * whether it was cut, so a text of exactly this length is treated as
 * truncated. Heuristic: a document whose full text happens to land on the cap
 * is reported as truncated even though nothing was lost.
 */
const MAX_EXTRACTED_CHARS = 40_000;

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

      // Dedupe — a repeated id must not consume extra document slots or
      // duplicate the document in the output.
      const requestedIds = [...new Set(documentIds ?? [])];

      const skipped: SkippedEntry[] = [];
      let orderedRecords: Awaited<
        ReturnType<typeof getProjectDocumentExtractionByIds>
      > = [];
      let totalDocuments = 0;

      if (requestedIds.length > 0) {
        const records = await getProjectDocumentExtractionByIds(requestedIds);

        // SECURITY: only keep documents that belong to THIS project. Any id
        // that does not resolve to a document in this project is reported as
        // "not-found" — never reveal that it exists in another project.
        const accessible = records.filter(
          (record) => record.projectId === projectId,
        );

        // Report requested ids that did not resolve to an accessible document.
        const accessibleIds = new Set(accessible.map((record) => record.id));
        for (const id of requestedIds) {
          if (!accessibleIds.has(id)) {
            skipped.push({ id, reason: "not-found" });
          }
        }

        // Honor the caller's ordering so the budget is applied predictably.
        for (const id of requestedIds) {
          const match = accessible.find((record) => record.id === id);
          if (match) {
            orderedRecords.push(match);
          }
        }
        totalDocuments = orderedRecords.length;

        // Cap the number of documents per call; the rest are reported so the
        // model can request them in a follow-up call.
        for (const record of orderedRecords.slice(MAX_DOCUMENTS_PER_CALL)) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "too-many-documents",
          });
        }
        orderedRecords = orderedRecords.slice(0, MAX_DOCUMENTS_PER_CALL);
      } else {
        // No ids: list the project's documents (query order, newest first) to
        // establish the order and the cap, then read the stored text only for
        // the documents that survive the cap.
        const listed = await getProjectDocumentsByProjectId(projectId);
        totalDocuments = listed.length;

        for (const record of listed.slice(MAX_DOCUMENTS_PER_CALL)) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "too-many-documents",
          });
        }

        const cappedIds = listed
          .slice(0, MAX_DOCUMENTS_PER_CALL)
          .map((record) => record.id);
        const extractions = await getProjectDocumentExtractionByIds(cappedIds);
        for (const id of cappedIds) {
          const match = extractions.find(
            (record) => record.id === id && record.projectId === projectId,
          );
          if (match) {
            orderedRecords.push(match);
          }
        }
      }

      const documents: ReadDocument[] = [];
      let remainingBudget = TOTAL_CHAR_BUDGET;

      for (const record of orderedRecords) {
        if (record.extractionStatus === "pending") {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "extraction-pending",
            message:
              "Text extraction is still running for this document; try again in a moment.",
          });
          continue;
        }

        if (record.extractionStatus === "failed") {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "extraction-failed",
            message: record.extractionError ?? undefined,
          });
          continue;
        }

        if (record.extractionStatus === "unsupported") {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "unsupported-format",
            message: record.extractionError ?? undefined,
          });
          continue;
        }

        const text = record.extractedText;
        if (!text) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "extraction-failed",
            message: "No text was stored for this document.",
          });
          continue;
        }

        if (remainingBudget <= 0) {
          skipped.push({
            id: record.id,
            filename: record.originalFilename,
            reason: "budget-exceeded",
          });
          continue;
        }

        const withinBudget = text.slice(0, remainingBudget);
        const budgetTruncated = withinBudget.length < text.length;
        remainingBudget -= withinBudget.length;

        documents.push({
          id: record.id,
          filename: record.originalFilename,
          text: withinBudget,
          truncated: budgetTruncated || text.length >= MAX_EXTRACTED_CHARS,
        });
      }

      return {
        documents,
        skipped,
        totalDocuments,
      };
    },
  });
};
