import type { ProjectDocumentSource } from "@wildfires-org/turboplan-db";
import {
  getOrganizationDocumentTextsByIds,
  getProjectDocumentExtractionByIds,
  getProjectDocumentsByProjectId,
  listOrganizationDocuments,
  type ProjectDocumentExtraction,
} from "@wildfires-org/turboplan-db/queries";
import {
  Action,
  EntityType,
  type EntityTypeType,
} from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  canonicalStorageUrl,
  isStorageHost,
} from "@wildfires-org/turboplan-upload/server";

import { getErrorName } from "@/lib/ai/chat-timing";
import {
  capReferenceText,
  type FetchReferenceContents,
  MAX_REFERENCE_URLS,
  type ReferenceCache,
  type ReferenceDocument,
  resolveReferenceDocuments,
} from "@/lib/ai/reference-documents";
import { UUID_PATTERN } from "@/lib/utils";

/**
 * A saved project or organization document createDocument was asked to model
 * a document on (by id, or by its storage URL), with its stored text.
 */
export type SavedReference = {
  kind: "project" | "organization";
  id: string;
  filename: string;
  url: string;
  extractionStatus: ProjectDocumentExtraction["extractionStatus"];
  /** Extracted text; null when there is none (pending, failed, unsupported or empty) */
  text: string | null;
  /**
   * A project document's origin: "research" when the research agent saved it
   * from an analog project, so its facts and letterhead are that project's.
   * Unset for organization documents.
   */
  source?: ProjectDocumentSource;
};

export type SavedReferences = {
  /** In request order: ids first, then storage URLs; each document once */
  references: SavedReference[];
  /**
   * `referenceUrls` still to read through getContents' cache or Exa: every URL
   * not on our storage host. A storage URL never goes to a third party — it
   * is read from the database or dropped (R2 is meant to become private).
   */
  webUrls: string[];
  /** Requested ids and storage URLs that matched no readable saved document */
  unresolved: number;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const canonicalStorageUrls = (urls: string[]): string[] =>
  unique(
    urls.flatMap((url) => {
      const canonical = canonicalStorageUrl(url);
      return canonical ? [canonical] : [];
    }),
  );

const storedText = ({
  extractionStatus,
  extractedText,
}: {
  extractionStatus: string;
  extractedText: string | null;
}): string | null =>
  extractionStatus === "done" && extractedText ? extractedText : null;

/**
 * Resolve createDocument's references to saved documents (no Exa, no storage
 * download): `documentIds` and `urls` on our storage host, at most
 * MAX_REFERENCE_URLS of each. Storage URLs are matched on their canonical
 * object URL, so the model's copy may differ in encoding or carry a fragment.
 *
 * Scoped like readProjectDocuments / readOrganizationDocuments: project
 * documents must belong to the chat's project and organization documents to
 * the organization bound for readOrganizationDocuments, and READ on each is
 * re-checked here. Organization documents are referenced from project chats
 * only: without a project nothing is read. Unknown, foreign or unreadable ids
 * and storage URLs only add to `unresolved`: our storage URLs are never handed
 * to Exa. Never throws: on failure only the other URLs stay on the web path.
 */
export const loadSavedReferences = async ({
  projectId,
  organizationId,
  userId,
  documentIds = [],
  urls = [],
}: {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  documentIds?: string[];
  urls?: string[];
}): Promise<SavedReferences> => {
  const requestedIds = unique(
    documentIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const trimmedUrls = urls.map((url) => url.trim()).filter(Boolean);
  // Our own storage URLs never leave for a third party (Exa).
  const webUrls = trimmedUrls.filter((url) => !isStorageHost(url));
  const storageUrls = unique(trimmedUrls.filter(isStorageHost));
  const nothingResolved: SavedReferences = {
    references: [],
    webUrls,
    unresolved: requestedIds.length + storageUrls.length,
  };

  const ids = requestedIds
    .filter((id) => UUID_PATTERN.test(id))
    .slice(0, MAX_REFERENCE_URLS);
  const storageObjects = canonicalStorageUrls(storageUrls).slice(
    0,
    MAX_REFERENCE_URLS,
  );
  if (
    !projectId ||
    !userId ||
    (ids.length === 0 && storageObjects.length === 0)
  ) {
    return nothingResolved;
  }

  try {
    const rbac = getRBACService();
    const canRead = async (entityId: string, entityType: EntityTypeType) => {
      const { allowed } = await rbac.checkPermission(
        userId,
        entityId,
        entityType,
        Action.READ,
      );
      return allowed;
    };

    // The listings (no text) map storage URLs to document ids: only needed
    // when there are storage URLs.
    const [
      canReadProject,
      canReadOrganization,
      projectListing,
      organizationListing,
    ] = await Promise.all([
      canRead(projectId, EntityType.PROJECT),
      organizationId ? canRead(organizationId, EntityType.ORGANIZATION) : false,
      storageObjects.length > 0
        ? getProjectDocumentsByProjectId(projectId)
        : [],
      organizationId && storageObjects.length > 0
        ? listOrganizationDocuments(organizationId)
        : [],
    ]);

    const idsMatchingStorageObjects = (rows: { id: string; url: string }[]) =>
      rows.flatMap(({ id, url }) => {
        const canonical = canonicalStorageUrl(url);
        return canonical && storageObjects.includes(canonical) ? [id] : [];
      });
    const projectIds = canReadProject
      ? unique([...ids, ...idsMatchingStorageObjects(projectListing)])
      : [];
    // Every id is tried on both sides: the organization text query is
    // organization-scoped, so a project's (or another organization's) id is
    // simply absent from its result.
    const organizationIds = canReadOrganization
      ? unique([...ids, ...idsMatchingStorageObjects(organizationListing)])
      : [];

    const [projectRows, organizationRows] = await Promise.all([
      projectIds.length > 0
        ? getProjectDocumentExtractionByIds(projectIds)
        : [],
      organizationId && organizationIds.length > 0
        ? getOrganizationDocumentTextsByIds(organizationId, organizationIds)
        : [],
    ]);

    const readable: SavedReference[] = [
      // SECURITY: the id lookup is not project-scoped; keep this project's
      // rows only, as readProjectDocuments does.
      ...projectRows
        .filter((row) => row.projectId === projectId)
        .map(
          (row): SavedReference => ({
            kind: "project",
            id: row.id,
            filename: row.originalFilename,
            url: row.url,
            extractionStatus: row.extractionStatus,
            text: storedText(row),
            source: row.source === "research" ? "research" : "upload",
          }),
        ),
      ...organizationRows.map(
        (row): SavedReference => ({
          kind: "organization",
          id: row.id,
          filename: row.originalFilename,
          url: row.url,
          extractionStatus: row.extractionStatus,
          text: storedText(row),
        }),
      ),
    ];

    const references: SavedReference[] = [];
    const added = new Set<string>();
    const add = (reference: SavedReference | undefined) => {
      if (!reference) {
        return;
      }
      const key = `${reference.kind}:${reference.id}`;
      if (!added.has(key)) {
        added.add(key);
        references.push(reference);
      }
    };
    for (const id of ids) {
      add(readable.find((reference) => reference.id === id));
    }
    for (const object of storageObjects) {
      add(
        readable.find(
          (reference) => canonicalStorageUrl(reference.url) === object,
        ),
      );
    }

    const resolvedIds = new Set(references.map(({ id }) => id));
    const resolvedObjects = new Set(
      canonicalStorageUrls(references.map(({ url }) => url)),
    );
    const unresolved =
      requestedIds.filter((id) => !resolvedIds.has(id)).length +
      storageUrls.filter((url) => {
        const canonical = canonicalStorageUrl(url);
        return !canonical || !resolvedObjects.has(canonical);
      }).length;

    return { references, webUrls, unresolved };
  } catch (error) {
    console.error(
      "[Document] Saved reference lookup failed:",
      getErrorName(error),
    );
    return nothingResolved;
  }
};

/**
 * What the generator gets from the saved references, at most
 * MAX_REFERENCE_URLS in request order: stored text, or — for a document
 * without text that is not in our storage, e.g. a research link to a public
 * page — that page, read like `referenceUrls`. A stored file without text is
 * skipped; references past the cap are dropped.
 */
const planSavedReferences = (saved: SavedReferences) => {
  const used: SavedReference[] = [];
  const skipped: SavedReference[] = [];
  let overCap = 0;
  for (const reference of saved.references) {
    if (reference.text === null && isStorageHost(reference.url)) {
      skipped.push(reference);
    } else if (used.length < MAX_REFERENCE_URLS) {
      used.push(reference);
    } else {
      overCap += 1;
    }
  }
  return { used, skipped, overCap };
};

/**
 * The saved references a new document may copy its letterhead from, in
 * request order: the ones the generator models it on and the ones skipped for
 * lack of text (a scan whose text was not read still has a letterhead) —
 * never those past the cap, which the report counts as unresolved.
 */
export const letterheadReferences = (
  saved: SavedReferences,
): SavedReference[] => {
  const { used, skipped } = planSavedReferences(saved);
  const kept = new Set([...used, ...skipped]);
  return saved.references.filter((reference) => kept.has(reference));
};

/** What createDocument's result says about the saved references it was given. */
export type SavedReferenceReport = {
  /** Filenames of the saved documents the generator models the document on */
  used: string[];
  /** Saved files without stored text: still being read, or unreadable */
  skipped: { filename: string; reason: "extraction-pending" | "no-text" }[];
  /** Requested ids or storage URLs not found, not readable or over the cap */
  unresolved?: number;
};

/** Undefined when no saved document was requested. */
export const reportSavedReferences = (
  saved: SavedReferences,
): SavedReferenceReport | undefined => {
  const { used, skipped, overCap } = planSavedReferences(saved);
  const unresolved = saved.unresolved + overCap;
  if (saved.references.length === 0 && unresolved === 0) {
    return undefined;
  }
  return {
    used: used.map(({ filename }) => filename),
    skipped: skipped.map(({ filename, extractionStatus }) => ({
      filename,
      reason: extractionStatus === "pending" ? "extraction-pending" : "no-text",
    })),
    ...(unresolved > 0 ? { unresolved } : {}),
  };
};

/**
 * The document generator's reference texts, at most MAX_REFERENCE_URLS:
 * saved documents' stored text first, then the web URLs (getContents' cache,
 * else one Exa fetch) for the slots left — saved public pages before
 * `referenceUrls`. Undefined when there is nothing to load, so the generator
 * gets no reference section.
 */
export const createReferenceLoader = ({
  saved,
  cache,
  fetchContents,
}: {
  saved: SavedReferences;
  cache: ReferenceCache;
  fetchContents: FetchReferenceContents;
}): (() => Promise<ReferenceDocument[]>) | undefined => {
  const { used } = planSavedReferences(saved);
  const savedDocuments = used.flatMap(
    ({ kind, source, url, filename, text }) =>
      text === null
        ? []
        : [
            capReferenceText({
              url,
              title: filename,
              text,
              // A research document is framed like a web reference.
              saved: source === "research" ? "research" : kind,
            }),
          ],
  );
  const webUrls = [
    ...used.flatMap(({ url, text }) => (text === null ? [url] : [])),
    ...saved.webUrls,
  ];
  const webSlots = MAX_REFERENCE_URLS - savedDocuments.length;
  const hasWebUrls = webSlots > 0 && webUrls.length > 0;
  if (savedDocuments.length === 0 && !hasWebUrls) {
    return undefined;
  }

  return async () => [
    ...savedDocuments,
    ...(hasWebUrls
      ? await resolveReferenceDocuments({
          urls: webUrls,
          cache,
          fetchContents,
          maxDocuments: webSlots,
        })
      : []),
  ];
};
