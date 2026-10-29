import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  getOrganizationDocumentTextsByIds,
  listOrganizationDocuments,
  type OrganizationDocumentListItem,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

/**
 * Reads the text of the reference documents saved by the organization that
 * owns the chat's project. Like `readProjectDocuments`, it only reads text the
 * research-agent extraction worker already stored; nothing is downloaded or
 * parsed here.
 *
 * Called without ids it lists every document of the organization instead, so
 * documents the budgeted system-prompt block only counts as "(+N more)" can
 * still be found and read.
 *
 * The organization is bound when the tool is created (resolved from the
 * project server-side) and is never taken from model input.
 */

/** Total character budget shared across all documents read in a single call. */
const TOTAL_CHAR_BUDGET = 60_000;

/**
 * Maximum number of documents read in a single call. Ids beyond the cap are
 * reported as skipped before any text is loaded, so one call never holds
 * more than this many extracted texts in memory.
 */
const MAX_DOCUMENTS_PER_CALL = 5;

/**
 * Upper bound on requested ids per call, so ids past the per-call cap are
 * still reported as "too-many-documents" rather than rejected by the schema.
 */
const MAX_REQUESTED_DOCUMENT_IDS = 20;

/**
 * Mirrors `MAX_EXTRACTED_CHARS` in
 * `@wildfires-org/turboplan-document-extraction`: a stored text of exactly
 * this length is treated as truncated by the extractor.
 */
const MAX_EXTRACTED_CHARS = 40_000;

/** Longest summary preview per document in list mode. */
const SUMMARY_PREVIEW_MAX_CHARS = 120;

/**
 * Size cap (serialized JSON) of a listing. Every document is always listed;
 * summary previews are added in listing order only while they fit, so 100
 * documents stay small.
 */
const LIST_CHAR_BUDGET = 20_000;

interface ReadOrganizationDocumentsProps {
  organizationId: string;
  userId: string;
}

type SkippedEntry = {
  id: string;
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

type ListedDocument = {
  id: string;
  filename: string;
  isPinned: boolean;
  status: OrganizationDocumentListItem["extractionStatus"];
  summary: string | null;
};

/** First non-empty summary line without its bullet marker, capped. */
const toSummaryPreview = (summary: string | null): string | null => {
  const firstLine = summary
    ?.split("\n")
    .map((line) =>
      line
        .replace(/^[\s#>*-]+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .find((line) => line.length > 0);
  if (!firstLine) {
    return null;
  }
  if (firstLine.length <= SUMMARY_PREVIEW_MAX_CHARS) {
    return firstLine;
  }
  return `${firstLine.slice(0, SUMMARY_PREVIEW_MAX_CHARS - 1).trimEnd()}…`;
};

/**
 * Every document, pinned first then newest (the order of the system-prompt
 * block). Previews stop at the first one that would push the listing past
 * `LIST_CHAR_BUDGET`, so the pinned and newest documents keep theirs.
 */
const buildDocumentListing = (
  records: OrganizationDocumentListItem[],
): ListedDocument[] => {
  // `listOrganizationDocuments` is newest first; the sort is stable.
  const ordered = [...records].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned),
  );
  const documents: ListedDocument[] = ordered.map((record) => ({
    id: record.id,
    filename: record.originalFilename,
    isPinned: record.isPinned,
    status: record.extractionStatus,
    summary: null,
  }));

  let listingChars = JSON.stringify(documents).length;
  for (const [index, record] of ordered.entries()) {
    const preview = toSummaryPreview(record.summary);
    if (!preview) {
      continue;
    }
    const addedChars = JSON.stringify(preview).length - "null".length;
    if (listingChars + addedChars > LIST_CHAR_BUDGET) {
      break;
    }
    documents[index].summary = preview;
    listingChars += addedChars;
  }

  return documents;
};

export const readOrganizationDocuments = async ({
  organizationId,
  userId,
}: ReadOrganizationDocumentsProps) => {
  const description = await getPrompt("tool-desc-read-organization-documents");

  return tool({
    description,
    inputSchema: z.object({
      documentIds: z
        .array(z.string().uuid())
        .max(MAX_REQUESTED_DOCUMENT_IDS)
        .optional()
        .describe(
          'IDs of organization documents to read, from the "[id: …]" after each document in the ORGANIZATION CONTEXT section or from a listing. Omit (or pass an empty array) to list every organization document instead.',
        ),
    }),
    execute: async ({ documentIds = [] }) => {
      // Re-assert READ permission at execution time — activeTools gating is a
      // convenience, this is the authoritative check before reading.
      const rbac = getRBACService();
      const permission = await rbac.checkPermission(
        userId,
        organizationId,
        EntityType.ORGANIZATION,
        Action.READ,
      );
      if (!permission.allowed) {
        return { error: "Access denied." };
      }

      if (documentIds.length === 0) {
        // SECURITY: scoped by the bound organization only.
        const documents = buildDocumentListing(
          await listOrganizationDocuments(organizationId),
        );
        return { documents, totalDocuments: documents.length };
      }

      // Dedupe — a repeated id must not consume extra document slots or
      // duplicate the document in the output.
      const requestedIds = [...new Set(documentIds)];
      const skipped: SkippedEntry[] = [];

      for (const id of requestedIds.slice(MAX_DOCUMENTS_PER_CALL)) {
        skipped.push({ id, reason: "too-many-documents" });
      }
      const cappedIds = requestedIds.slice(0, MAX_DOCUMENTS_PER_CALL);

      // SECURITY: scoped by organization — ids of another organization's
      // documents are absent and reported as "not-found", never revealed.
      const records = await getOrganizationDocumentTextsByIds(
        organizationId,
        cappedIds,
      );

      const documents: ReadDocument[] = [];
      let remainingBudget = TOTAL_CHAR_BUDGET;
      let totalDocuments = 0;

      // Honor the caller's ordering so the budget is applied predictably.
      for (const id of cappedIds) {
        const record = records.find((candidate) => candidate.id === id);
        if (!record) {
          skipped.push({ id, reason: "not-found" });
          continue;
        }
        totalDocuments += 1;

        if (record.extractionStatus === "pending") {
          skipped.push({
            id,
            filename: record.originalFilename,
            reason: "extraction-pending",
            message:
              "Text extraction is still running for this document; try again in a moment.",
          });
          continue;
        }

        if (record.extractionStatus === "failed") {
          skipped.push({
            id,
            filename: record.originalFilename,
            reason: "extraction-failed",
          });
          continue;
        }

        if (record.extractionStatus === "unsupported") {
          skipped.push({
            id,
            filename: record.originalFilename,
            reason: "unsupported-format",
          });
          continue;
        }

        const text = record.extractedText;
        if (!text) {
          skipped.push({
            id,
            filename: record.originalFilename,
            reason: "extraction-failed",
            message: "No text was stored for this document.",
          });
          continue;
        }

        if (remainingBudget <= 0) {
          skipped.push({
            id,
            filename: record.originalFilename,
            reason: "budget-exceeded",
          });
          continue;
        }

        const withinBudget = text.slice(0, remainingBudget);
        const budgetTruncated = withinBudget.length < text.length;
        remainingBudget -= withinBudget.length;

        documents.push({
          id,
          filename: record.originalFilename,
          text: withinBudget,
          truncated: budgetTruncated || text.length >= MAX_EXTRACTED_CHARS,
        });
      }

      return { documents, skipped, totalDocuments };
    },
  });
};
