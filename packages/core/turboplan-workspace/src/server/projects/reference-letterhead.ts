import type { ProjectDocumentSource } from "@wildfires-org/turboplan-db";
import {
  getOrganizationDocumentLetterheadAnalyses,
  getProjectDocumentLetterheadAnalyses,
  getProjectIdByDocumentId,
  type ProjectDocumentLetterheadAnalysis,
  upsertDocumentLetterheadSelection,
  upsertDocumentOwnLetterhead,
} from "@wildfires-org/turboplan-db/queries";

import type { GridDocumentLetterhead } from "../../letterhead";
import {
  type GridLetterhead,
  gridToDocumentLetterhead,
  usableGridLetterhead,
} from "../../letterhead-grid";

/** A saved project or organization document a new document is modeled on. */
export type LetterheadReference = {
  kind: "project" | "organization";
  id: string;
  /**
   * A project document's origin. "research": the research agent saved it from
   * an analog project, so its letterhead is that project's sender's — copied
   * to be offered, never selected.
   */
  source?: ProjectDocumentSource;
};

export type CopiedReferenceLetterhead = {
  letterhead: GridDocumentLetterhead;
  /** The reference's filename, as stored with its analysis */
  referenceFilename: string;
  /** False when the copy is only offered in the document's Letterhead menu */
  selected: boolean;
};

export type ReferenceLetterheadCopy = {
  /** Null when nothing was copied */
  copied: CopiedReferenceLetterhead | null;
  /**
   * Filenames of the references whose letterhead analysis has not run yet and
   * whose copy would be selected, among those tried before the copy (all of
   * them when nothing was copied): each may still turn out to have the
   * letterhead the document would carry.
   */
  pendingFilenames: string[];
};

// Same columns for project and organization documents.
type Analysis = Pick<
  ProjectDocumentLetterheadAnalysis,
  "id" | "originalFilename" | "letterheadStatus" | "letterheadAnalysis"
>;

// The reference's stored grid when its analysis found a letterhead that can
// render; null for one not analyzed yet, without a letterhead, failed or invalid.
// A "done" analysis always carries a grid, so one that does not render points
// at the producer and the schema drifting apart: logged (id only, no text).
const referenceGrid = (analysis: Analysis): GridLetterhead | null => {
  if (analysis.letterheadStatus !== "done") {
    return null;
  }
  const grid = usableGridLetterhead(analysis.letterheadAnalysis?.grid);
  if (!grid) {
    console.warn(
      "[letterhead] Analyzed reference has no usable letterhead grid:",
      analysis.id,
    );
  }
  return grid;
};

/**
 * Give a new document a copy of the letterhead of the first reference (in the
 * given order, research documents last) whose letterhead analysis is done and
 * valid: store it as the document's own copy and, unless `select` is false or
 * the reference is a research document, select it ("own"). An unselected
 * copy (a library letterhead the user named wins, or another project's
 * letterhead) is only offered in the document's Letterhead menu. References whose analysis is
 * still pending are skipped (and reported, see `pendingFilenames`). Database
 * reads and writes only — no network, no model — so it fits the
 * document-creation path.
 *
 * The analyses are read scoped: project references within `projectId`,
 * organization references within `organizationId` (skipped without one), so a
 * foreign id is simply never found. Like `chooseDocumentLetterhead` it runs
 * before the document's first save (neither table has a document FK); a
 * document that already exists must belong to `projectId`, else nothing is
 * written. Never throws: document generation must not fail on the letterhead.
 */
export const copyReferenceLetterhead = async ({
  projectId,
  organizationId,
  documentId,
  references,
  userId,
  select = true,
}: {
  projectId: string;
  organizationId?: string | null;
  documentId: string;
  references: LetterheadReference[];
  userId?: string | null;
  select?: boolean;
}): Promise<ReferenceLetterheadCopy> => {
  const pendingFilenames: string[] = [];
  const nothingCopied = (): ReferenceLetterheadCopy => ({
    copied: null,
    pendingFilenames,
  });
  if (references.length === 0) {
    return nothingCopied();
  }

  try {
    const idsOf = (kind: LetterheadReference["kind"]) =>
      references
        .filter((reference) => reference.kind === kind)
        .map(({ id }) => id);
    // Both analysis queries answer an empty id list without a round-trip.
    const [documentProjectId, projectAnalyses, organizationAnalyses] =
      await Promise.all([
        getProjectIdByDocumentId({ id: documentId }),
        getProjectDocumentLetterheadAnalyses(projectId, idsOf("project")),
        organizationId
          ? getOrganizationDocumentLetterheadAnalyses(
              organizationId,
              idsOf("organization"),
            )
          : [],
      ]);
    // Null: the document is not saved yet (the creation path). Never write
    // for another project's document.
    if (documentProjectId !== null && documentProjectId !== projectId) {
      return nothingCopied();
    }

    // Research documents last: another project's letterhead listed first
    // must not keep an uploaded reference's from being copied and selected.
    const ordered = [
      ...references.filter(({ source }) => source !== "research"),
      ...references.filter(({ source }) => source === "research"),
    ];
    for (const reference of ordered) {
      const analyses: Analysis[] =
        reference.kind === "project" ? projectAnalyses : organizationAnalyses;
      const analysis = analyses.find(({ id }) => id === reference.id);
      if (!analysis) {
        continue;
      }
      const selected = select && reference.source !== "research";
      // Only "pending" is still to come: "failed" (attempts exhausted) and
      // "none" are final. Reported only when its copy would be selected: one
      // that would only be offered changes nothing the document carries.
      if (analysis.letterheadStatus === "pending") {
        if (selected) {
          pendingFilenames.push(analysis.originalFilename);
        }
        continue;
      }
      const grid = referenceGrid(analysis);
      if (!grid) {
        continue;
      }

      // The copy first, then its selection: a failed copy throws before the
      // selection is touched, so the document keeps what it had (e.g. the
      // model's "none") rather than "own" without a copy. A failed selection
      // leaves an unselected copy, which the Letterhead menu still offers.
      const updatedBy = userId ?? null;
      await upsertDocumentOwnLetterhead({
        documentId,
        letterhead: grid,
        referenceFilename: analysis.originalFilename,
        ...(reference.kind === "project"
          ? { referenceProjectDocumentId: reference.id }
          : { referenceOrganizationDocumentId: reference.id }),
        updatedBy,
      });
      if (selected) {
        await upsertDocumentLetterheadSelection({
          documentId,
          letterheadId: null,
          useOwn: true,
          updatedBy,
        });
      }
      return {
        copied: {
          letterhead: gridToDocumentLetterhead(grid),
          referenceFilename: analysis.originalFilename,
          selected,
        },
        pendingFilenames,
      };
    }
    return nothingCopied();
  } catch (error) {
    console.error(
      "[letterhead] Reference letterhead copy failed:",
      error instanceof Error ? error.name : typeof error,
    );
    return nothingCopied();
  }
};
