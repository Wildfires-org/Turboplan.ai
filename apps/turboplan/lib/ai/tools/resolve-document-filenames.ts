/**
 * Pure filename resolution for the `readProjectDocuments` tool, kept apart
 * from the DB and RBAC calls so it can be unit-tested.
 */

type NamedDocument = {
  id: string;
  originalFilename: string;
  /** "upload" for the user's own files, "research" for research-agent ones */
  source?: string;
};

type DocumentReadRequest = {
  documentIds?: ReadonlyArray<string>;
  filenames?: ReadonlyArray<string>;
};

export const normalizeFilename = (filename: string) =>
  filename.trim().toLowerCase();

/**
 * Reading every project document is the answer to a call that names nothing.
 * A call that names files is never widened to all of them, even when none of
 * its names match.
 */
export const isReadAllRequest = ({
  documentIds,
  filenames,
}: DocumentReadRequest): boolean =>
  (documentIds?.length ?? 0) === 0 && (filenames?.length ?? 0) === 0;

/**
 * Map requested filenames to document ids. `documents` must be ordered newest
 * first, so a re-uploaded file resolves to its latest copy. The user's own
 * uploads are searched first, so a research document that happens to share a
 * name cannot shadow an attachment; a name no upload has falls back to the
 * other documents (newest first), which the system prompt lists by name too.
 * Names are matched case-insensitively, ignoring surrounding whitespace, and
 * a name requested twice in different spellings counts once (the first
 * spelling is the one reported when it misses).
 */
export const resolveDocumentFilenames = (
  filenames: ReadonlyArray<string>,
  documents: ReadonlyArray<NamedDocument>,
): { ids: Array<string>; missingFilenames: Array<string> } => {
  const requested = new Map<string, string>();
  for (const filename of filenames) {
    const normalized = normalizeFilename(filename);
    if (!requested.has(normalized)) {
      requested.set(normalized, filename);
    }
  }

  const searchOrder = [
    ...documents.filter((document) => document.source === "upload"),
    ...documents.filter((document) => document.source !== "upload"),
  ];

  const ids: Array<string> = [];
  const missingFilenames: Array<string> = [];
  for (const [normalized, filename] of requested) {
    const match = searchOrder.find(
      (document) => normalizeFilename(document.originalFilename) === normalized,
    );
    if (match) {
      ids.push(match.id);
    } else {
      missingFilenames.push(filename);
    }
  }

  return { ids, missingFilenames };
};
