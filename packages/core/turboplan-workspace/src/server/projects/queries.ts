import { generateText } from "ai";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  assertCreditsAvailable,
  CreditsExhaustedError,
  meterAiCall,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import type { NewEmptyStateSuggestion } from "@wildfires-org/turboplan-db";
import {
  document,
  emptyStateSuggestion,
  generatedImages,
  milestones,
  office,
  officeUsers,
  organization,
  organizationUsers,
  type Project,
  profile,
  project,
  projectDocument,
  projectField,
  projectUsers,
  tasks,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  deleteDocumentLetterheadSelection,
  getDocumentLetterheadById,
  getDocumentLetterheadSelectionRow,
  getDocumentOwnLetterhead,
  getOrganizationIdForProject,
  getProjectIdByDocumentId,
  listDocumentLetterheads,
  updateDocumentOwnLetterhead,
  upsertDocumentLetterheadSelection,
} from "@wildfires-org/turboplan-db/queries";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { ownedUploadKey } from "@wildfires-org/turboplan-upload/server";
import { isValidSlug } from "@wildfires-org/turboplan-utils/server";

import {
  type DocumentProfile,
  mergeDocumentProfiles,
} from "../../document-profile";
import {
  type DocumentLetterhead,
  effectiveSelection,
  type LetterheadCandidate,
  type LetterheadLayout,
  type LetterheadLogoPlacement,
  type LetterheadSelection,
  libraryLetterheadToCandidate,
  libraryLetterheadToDocumentLetterhead,
  normalizeLetterheadChoice,
  planLetterheadBranding,
  selectionFromRow,
  toPublicDocumentLetterhead,
} from "../../letterhead";
import {
  type GridLetterhead,
  gridToDocumentLetterhead,
  type PublicGridLetterhead,
  usableGridLetterhead,
} from "../../letterhead-grid";
import {
  applyGridLetterheadEdit,
  type GridLetterheadEdit,
} from "../../letterhead-grid-edit";
import { gridLogoCells } from "../../letterhead-grid-layout";
import type { SlugLookupResult } from "../../types";
import {
  errorName,
  type ImageBytes,
  readLetterheadImage,
} from "../letterhead-image";
import { getOfficeById } from "../offices/queries";
import { getOrganizationById } from "../organizations/queries";
import { assertSlugNotReserved, generateAvailableSlug } from "../slug-policy";
import { withoutLetterheadGrid } from "../without-letterhead-grid";
import {
  isProjectDocumentInScope,
  resolveTemplateCopyScope,
} from "./template-copy-policy";
import type {
  CreateProjectRequest,
  ProjectStatus,
  ProjectWithCoverImage,
  UpdateProjectRequest,
  UserProject,
} from "./types";

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const [proj] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt)));
    return proj || null;
  } catch (error) {
    console.error("Failed to get project from database");
    throw error;
  }
}

// An entity's letterhead logo: its `documentLogoUrl`, unless its letterhead
// layout is "banner" — then that URL is the banner graphic (drawn across the
// content width), never a logo to place beside or above a letterhead.
const entityLetterheadLogoUrl = (entity: {
  documentLetterheadLayout: LetterheadLayout | null;
  documentLogoUrl: string | null;
}): string | null =>
  entity.documentLetterheadLayout === "banner" ? null : entity.documentLogoUrl;

/**
 * Resolve the letterhead logo URL for a project: the logo of a letterhead
 * that has no logo of its own (a legacy layout, or the margin logo of a grid
 * without logo cells).
 *
 * Resolution order: the owning office's `documentLogoUrl`, falling back to the
 * owning organization's `documentLogoUrl`; an entity whose letterhead layout
 * is "banner" has no letterhead logo (its `documentLogoUrl` is the banner
 * graphic). Returns null when the project is invalid or neither entity has a
 * letterhead logo.
 */
export async function resolveProjectLetterheadLogoUrl(
  projectId: string,
): Promise<string | null> {
  const proj = await getProjectById(projectId);
  if (!proj) {
    return null;
  }

  const office = await getOfficeById(proj.officeId);
  if (!office) {
    return null;
  }

  const officeLogoUrl = entityLetterheadLogoUrl(office);
  if (officeLogoUrl) {
    return officeLogoUrl;
  }

  const org = await getOrganizationById(office.organizationId);
  return org ? entityLetterheadLogoUrl(org) : null;
}

/**
 * Resolve and download the letterhead logo for a project as raw bytes.
 *
 * Returns null when no logo is configured, the projectId is invalid, the fetch
 * fails, or the resolved resource is not a PNG/JPEG (the only formats both the
 * PDF and docx generators accept).
 */
export async function getProjectLetterheadLogo(
  projectId: string,
): Promise<ImageBytes | null> {
  try {
    const url = await resolveProjectLetterheadLogoUrl(projectId);
    return await readLetterheadImage({ url });
  } catch (error) {
    console.error("Failed to fetch project letterhead logo:", error);
    return null;
  }
}

type DefaultLetterhead = {
  letterhead: DocumentLetterhead | null;
  // A banner's graphic (the entity's document logo); null for every other
  // letterhead (a grid's logos are its logo cells).
  logoUrl: string | null;
};

/**
 * An office's or organization's default letterhead: its grid when one is set
 * and usable (the legacy fields are ignored then), else its legacy layout
 * when configured, else null.
 */
const entityDefaultLetterhead = (entity: {
  documentLetterheadGrid: unknown;
  documentLetterheadLayout: LetterheadLayout | null;
  documentLetterheadLines: string | null;
  documentLetterheadContact: string | null;
  documentLetterheadColor: string | null;
  documentLogoUrl: string | null;
}): DefaultLetterhead | null => {
  const grid = usableGridLetterhead(entity.documentLetterheadGrid);
  if (grid) {
    return { letterhead: gridToDocumentLetterhead(grid), logoUrl: null };
  }

  const letterhead = libraryLetterheadToDocumentLetterhead({
    layout: entity.documentLetterheadLayout,
    lines: entity.documentLetterheadLines,
    contact: entity.documentLetterheadContact,
    logoUrl: entity.documentLogoUrl,
    color: entity.documentLetterheadColor,
  });
  if (!letterhead) {
    return null;
  }
  return {
    letterhead,
    logoUrl: letterhead.layout === "banner" ? entity.documentLogoUrl : null,
  };
};

/**
 * The office → org default letterhead plus the URL of its own logo (see
 * {@link DefaultLetterhead}). Per entity a grid wins over the legacy fields:
 * office grid → office legacy → org grid → org legacy.
 */
async function resolveProjectDefaultLetterhead(
  projectId: string,
): Promise<DefaultLetterhead> {
  const none = { letterhead: null, logoUrl: null };
  const proj = await getProjectById(projectId);
  if (!proj) {
    return none;
  }

  const office = await getOfficeById(proj.officeId);
  if (!office) {
    return none;
  }

  const fromOffice = entityDefaultLetterhead(office);
  if (fromOffice) {
    return fromOffice;
  }

  const org = await getOrganizationById(office.organizationId);
  return (org && entityDefaultLetterhead(org)) || none;
}

/**
 * Resolve the structured document letterhead for a project.
 *
 * Unlike the footer, the letterhead resolves as a whole (never mixing office
 * and org lines or colors): the office wins when it is configured (a grid,
 * name lines, or a banner with a document logo), else the organization, else
 * null. Layout defaults to "split".
 */
export async function getProjectLetterhead(
  projectId: string,
): Promise<DocumentLetterhead | null> {
  return (await resolveProjectDefaultLetterhead(projectId)).letterhead;
}

/**
 * Resolve the document footer for a project: tagline text, right-aligned note,
 * and footer logo bytes.
 *
 * Each field resolves independently with office → org fallback (an office value
 * wins per-field; org fills the gaps). The logo is downloaded and guarded to the
 * PNG/JPEG formats both the PDF and docx generators accept. Returns nulls for
 * any field that is unset (or, for the logo, unreachable/unsupported).
 */
export async function getProjectFooter(projectId: string): Promise<{
  text: string | null;
  note: string | null;
  logo: { data: Uint8Array; contentType: string } | null;
}> {
  try {
    const proj = await getProjectById(projectId);
    if (!proj) {
      return { text: null, note: null, logo: null };
    }

    const office = await getOfficeById(proj.officeId);
    if (!office) {
      return { text: null, note: null, logo: null };
    }

    const org = await getOrganizationById(office.organizationId);

    const text = office.documentFooterText || org?.documentFooterText || null;
    const note = office.documentFooterNote || org?.documentFooterNote || null;
    const logoUrl =
      office.documentFooterLogoUrl || org?.documentFooterLogoUrl || null;

    const logo = await readLetterheadImage({ url: logoUrl });

    return { text, note, logo };
  } catch (error) {
    console.error("Failed to fetch project footer:", error);
    return { text: null, note: null, logo: null };
  }
}

/**
 * Resolve the document profile for a project: the office profile merged over
 * the organization profile (office wins per field; facts are combined). An
 * unknown project or office resolves to an empty profile.
 */
export async function getProjectDocumentProfile(
  projectId: string,
): Promise<DocumentProfile> {
  const proj = await getProjectById(projectId);
  if (!proj) {
    return {};
  }

  const office = await getOfficeById(proj.officeId);
  if (!office) {
    return {};
  }

  const org = await getOrganizationById(office.organizationId);
  return mergeDocumentProfiles(office.documentProfile, org?.documentProfile);
}

/** The letterhead a document selected (see {@link LetterheadSelection}). */
export async function getDocumentLetterheadSelection(
  documentId: string,
): Promise<LetterheadSelection> {
  return selectionFromRow(await getDocumentLetterheadSelectionRow(documentId));
}

export type { ImageBytes };

// The document's own copy of its reference's letterhead, validated.
// `version`: its `updated_at` as an ISO string — the letterhead editor sends
// it back, so an edit made on an older copy is refused (see
// `editDocumentOwnLetterhead`).
type OwnLetterhead = {
  grid: GridLetterhead;
  referenceFilename: string;
  version: string;
};

const toOwnLetterhead = (
  row: {
    letterhead: unknown;
    referenceFilename: string;
    updatedAt: Date;
  } | null,
): OwnLetterhead | null => {
  const grid = row && usableGridLetterhead(row.letterhead);
  return grid
    ? {
        grid,
        referenceFilename: row.referenceFilename,
        version: row.updatedAt.toISOString(),
      }
    : null;
};

type ResolvedSelection = (
  | { selection: "default" | "none" | "own"; library: null }
  | {
      selection: string;
      library: NonNullable<
        Awaited<ReturnType<typeof getDocumentLetterheadById>>
      >;
    }
) & {
  // The document's copy: set when "own" is selected, and with `includeOwn`
  // whatever is selected (the picker offers it).
  own: OwnLetterhead | null;
};

/**
 * The selection that applies to `documentId` when rendered in `projectId`.
 * A document outside the project, a library letterhead outside the project's
 * organization, and "own" without a (valid) copy resolve to "default".
 */
async function resolveSelection(
  projectId: string,
  documentId: string | undefined,
  { includeOwn = false }: { includeOwn?: boolean } = {},
): Promise<ResolvedSelection> {
  const fallback = { selection: "default", library: null, own: null } as const;
  if (!documentId) {
    return fallback;
  }

  // Checked first: the selection and own-letterhead queries are keyed by
  // document id only.
  if ((await getProjectIdByDocumentId({ id: documentId })) !== projectId) {
    return fallback;
  }

  // `undefined`: the copy was not read (yet).
  const [stored, ownRow] = await Promise.all([
    getDocumentLetterheadSelection(documentId),
    includeOwn ? getDocumentOwnLetterhead(documentId) : undefined,
  ]);
  const own =
    includeOwn || stored === "own"
      ? toOwnLetterhead(
          ownRow === undefined
            ? await getDocumentOwnLetterhead(documentId)
            : ownRow,
        )
      : null;

  if (stored === "default" || stored === "none") {
    return { selection: stored, library: null, own };
  }
  if (stored === "own") {
    return own ? { selection: "own", library: null, own } : fallback;
  }

  const [library, organizationId] = await Promise.all([
    getDocumentLetterheadById(stored),
    getOrganizationIdForProject(projectId),
  ]);
  const selection = effectiveSelection(
    stored,
    library?.organizationId,
    organizationId,
  );
  if (selection === "default" || !library) {
    return { selection: "default", library: null, own };
  }
  return { selection, library, own };
}

const resolveProjectDefaultLetterheadSafe = (
  projectId: string,
): Promise<DefaultLetterhead> =>
  resolveProjectDefaultLetterhead(projectId).catch((error: unknown) => {
    console.error("Failed to resolve project letterhead:", error);
    return { letterhead: null, logoUrl: null };
  });

const getProjectLetterheadSafe = async (projectId: string) =>
  (await resolveProjectDefaultLetterheadSafe(projectId)).letterhead;

type LetterheadLogos = {
  logo: ImageBytes | null;
  logos: (ImageBytes | null)[];
};

/**
 * A grid's logos: one per logo cell in `gridLogoCells` order (its `index`),
 * read in parallel by object key (`readLetterheadImage`), null in the slot of
 * one that does not load. Its single logo (legacy renderers, the margin) is
 * the first logo cell's — never another one when that fails — or, for a grid
 * without logo cells, the office → org letterhead logo.
 */
const resolveGridLogos = async (
  projectId: string,
  grid: GridLetterhead,
): Promise<LetterheadLogos> => {
  const logos = await Promise.all(
    gridLogoCells(grid).map((cell) => readLetterheadImage({ key: cell.key })),
  );
  if (logos.length > 0) {
    return { logo: logos[0], logos };
  }
  return { logo: await getProjectLetterheadLogo(projectId), logos };
};

export type ResolvedDocumentLetterhead = LetterheadLogos & {
  letterhead: DocumentLetterhead | null;
  selection: LetterheadSelection;
};

/**
 * Resolve the letterhead and letterhead logo(s) a document is rendered with:
 * the office → org default, none, the document's own copy of its reference's
 * letterhead, or the selected library letterhead. Without a `documentId` this
 * is always the default. `logo` is the single logo: for a banner the banner
 * graphic of the entity the letterhead came from; for a grid (the copy, or a
 * grid default) its first logo cell, or the office → org letterhead logo when
 * it has no logo cell (see `resolveGridLogos`); otherwise the office → org
 * letterhead logo. `logos` holds a grid's logos by cell `index`; empty for
 * every other letterhead.
 */
export async function resolveDocumentLetterhead(
  projectId: string,
  documentId?: string,
): Promise<ResolvedDocumentLetterhead> {
  const { selection, library, own } = await resolveSelection(
    projectId,
    documentId,
  );

  if (selection === "none") {
    return { letterhead: null, logo: null, logos: [], selection };
  }

  if (selection === "own" && own) {
    return {
      letterhead: gridToDocumentLetterhead(own.grid),
      ...(await resolveGridLogos(projectId, own.grid)),
      selection,
    };
  }

  if (!library) {
    const { letterhead, logoUrl } =
      await resolveProjectDefaultLetterheadSafe(projectId);
    if (letterhead?.layout === "grid") {
      return {
        letterhead,
        ...(await resolveGridLogos(projectId, letterhead.grid)),
        selection: "default",
      };
    }
    const logo =
      letterhead?.layout === "banner"
        ? await readLetterheadImage({ url: logoUrl })
        : await getProjectLetterheadLogo(projectId);
    return { letterhead, logo, logos: [], selection: "default" };
  }

  const logo = await readLetterheadImage({ url: library.logoUrl });
  return {
    letterhead: libraryLetterheadToDocumentLetterhead(library),
    logo,
    logos: [],
    selection,
  };
}

/**
 * The one logo `GET /letterhead-logo?index=` serves, fetching no other: for a
 * grid letterhead (the document's copy or a grid default) its logo cell
 * `index` (`gridLogoCells` order), or — a grid without logo cells — the
 * office → org letterhead logo at index 0; for every other letterhead its
 * single logo (see {@link resolveDocumentLetterhead}) at index 0. Null for
 * "none", past the last logo, and for a logo that does not load.
 */
export async function resolveDocumentLetterheadLogo(
  projectId: string,
  documentId: string | undefined,
  index: number,
): Promise<ImageBytes | null> {
  const { selection, library, own } = await resolveSelection(
    projectId,
    documentId,
  );

  if (selection === "none") {
    return null;
  }

  const gridLogo = async (grid: GridLetterhead) => {
    const cells = gridLogoCells(grid);
    if (cells.length > 0) {
      const cell = cells[index];
      return cell ? readLetterheadImage({ key: cell.key }) : null;
    }
    return index === 0 ? getProjectLetterheadLogo(projectId) : null;
  };

  if (selection === "own" && own) {
    return gridLogo(own.grid);
  }

  if (library) {
    return index === 0 ? readLetterheadImage({ url: library.logoUrl }) : null;
  }

  const { letterhead, logoUrl } =
    await resolveProjectDefaultLetterheadSafe(projectId);
  if (letterhead?.layout === "grid") {
    return gridLogo(letterhead.grid);
  }
  if (index !== 0) {
    return null;
  }
  return letterhead?.layout === "banner"
    ? readLetterheadImage({ url: logoUrl })
    : getProjectLetterheadLogo(projectId);
}

/**
 * Everything the letterhead picker shows for a document: the resolved
 * letterhead and selection, the default (office → org) letterhead, the
 * project organization's library letterheads, and whether the document has
 * its own copy of its reference's letterhead (`own`, offered whatever is
 * selected, with the `version` the letterhead editor sends back). No logo
 * bytes are fetched.
 */
export async function getDocumentLetterheadOverview(
  projectId: string,
  documentId?: string,
): Promise<{
  letterhead: DocumentLetterhead | null;
  selection: LetterheadSelection;
  defaultLetterhead: DocumentLetterhead | null;
  options: { id: string; name: string }[];
  own: { referenceFilename: string; version: string } | null;
}> {
  const [{ selection, library, own }, defaultLetterhead, organizationId] =
    await Promise.all([
      resolveSelection(projectId, documentId, { includeOwn: true }),
      getProjectLetterheadSafe(projectId),
      getOrganizationIdForProject(projectId),
    ]);
  const libraryRows = organizationId
    ? await listDocumentLetterheads(organizationId)
    : [];

  let letterhead: DocumentLetterhead | null = null;
  if (library) {
    letterhead = libraryLetterheadToDocumentLetterhead(library);
  } else if (selection === "own" && own) {
    letterhead = gridToDocumentLetterhead(own.grid);
  } else if (selection === "default") {
    letterhead = defaultLetterhead;
  }

  return {
    letterhead,
    selection,
    defaultLetterhead,
    options: libraryRows.map(({ id, name }) => ({ id, name })),
    own: own
      ? { referenceFilename: own.referenceFilename, version: own.version }
      : null,
  };
}

/**
 * Store a document's letterhead selection. Fails (without revealing which
 * check failed) unless the document belongs to the project, a library
 * letterhead belongs to the project's organization, and "own" has a copy.
 */
export async function setDocumentLetterheadSelection({
  projectId,
  documentId,
  selection,
  userId,
}: {
  projectId: string;
  documentId: string;
  selection: LetterheadSelection;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: "document" | "letterhead" }> {
  if ((await getProjectIdByDocumentId({ id: documentId })) !== projectId) {
    return { ok: false, reason: "document" };
  }

  if (selection === "default") {
    await deleteDocumentLetterheadSelection(documentId);
    return { ok: true };
  }

  if (selection === "none") {
    await upsertDocumentLetterheadSelection({
      documentId,
      letterheadId: null,
      updatedBy: userId,
    });
    return { ok: true };
  }

  if (selection === "own") {
    // Validated like rendering does: a copy that no longer validates would
    // render as the default, so it cannot be selected either.
    if (!toOwnLetterhead(await getDocumentOwnLetterhead(documentId))) {
      return { ok: false, reason: "letterhead" };
    }
    await upsertDocumentLetterheadSelection({
      documentId,
      letterheadId: null,
      useOwn: true,
      updatedBy: userId,
    });
    return { ok: true };
  }

  const [library, organizationId] = await Promise.all([
    getDocumentLetterheadById(selection),
    getOrganizationIdForProject(projectId),
  ]);
  if (
    effectiveSelection(selection, library?.organizationId, organizationId) !==
    selection
  ) {
    return { ok: false, reason: "letterhead" };
  }

  await upsertDocumentLetterheadSelection({
    documentId,
    letterheadId: selection,
    updatedBy: userId,
  });
  return { ok: true };
}

export type EditDocumentOwnLetterheadResult =
  // `version`: the saved copy's new version.
  | { ok: true; letterhead: DocumentLetterhead; version: string }
  // The document is not in the project, or has no (valid) copy.
  | { ok: false; reason: "not_found" }
  // The copy is no longer the `version` the edit was made on (edited
  // elsewhere, or replaced by a new draft), so its logo indexes may mean
  // other logos.
  | { ok: false; reason: "conflict" }
  // `field` / `message`: see `applyGridLetterheadEdit`.
  | { ok: false; reason: "invalid"; field: string; message: string };

/**
 * Replace the grid of a document's own letterhead copy with the letterhead
 * editor's version (see `applyGridLetterheadEdit`): a kept logo is the
 * copy's logo (its key) at that index, a new logo must be an upload of
 * `userId` (`uploads/<userId>/…` under the storage write base) and is stored
 * by its object key (`ownedUploadKey`). `version` is the
 * copy's version the editor was opened on (`own.version` of
 * `getDocumentLetterheadOverview`). Checks, in order: the document belongs to
 * the project, it has a copy that validates (as rendering does), the copy is
 * still that version, the edit is valid; the write itself only applies to
 * that version (a concurrent edit in between is a conflict too). Only that
 * document's copy changes; the selection is left as it is.
 */
export async function editDocumentOwnLetterhead({
  projectId,
  documentId,
  version,
  edit,
  userId,
}: {
  projectId: string;
  documentId: string;
  version: string;
  edit: GridLetterheadEdit;
  userId: string;
}): Promise<EditDocumentOwnLetterheadResult> {
  const notFound = { ok: false, reason: "not_found" } as const;
  const conflict = { ok: false, reason: "conflict" } as const;
  // Checked first: the own-letterhead queries are keyed by document id only.
  if ((await getProjectIdByDocumentId({ id: documentId })) !== projectId) {
    return notFound;
  }

  const own = toOwnLetterhead(await getDocumentOwnLetterhead(documentId));
  if (!own) {
    return notFound;
  }
  // Before the edit is applied: its logo indexes refer to that version.
  if (own.version !== version) {
    return conflict;
  }

  const result = applyGridLetterheadEdit(edit, own.grid, (url) =>
    ownedUploadKey(url, userId),
  );
  if (!result.ok) {
    return { ...result, reason: "invalid" };
  }

  const updatedAt = await updateDocumentOwnLetterhead({
    documentId,
    letterhead: result.grid,
    updatedBy: userId,
    expectedUpdatedAt: new Date(version),
  });
  if (!updatedAt) {
    return conflict;
  }
  return {
    ok: true,
    letterhead: gridToDocumentLetterhead(result.grid),
    version: updatedAt.toISOString(),
  };
}

/**
 * The letterheads the chat model may choose from for a new project document:
 * the office → org default and the project organization's library letterheads
 * that have something to render, oldest first. Never throws — on failure no
 * choices are offered.
 */
export const listProjectLetterheadCandidates = async (
  projectId: string,
): Promise<{
  defaultLetterhead: DocumentLetterhead | null;
  library: LetterheadCandidate[];
}> => {
  try {
    const [defaultLetterhead, organizationId] = await Promise.all([
      getProjectLetterheadSafe(projectId),
      getOrganizationIdForProject(projectId),
    ]);
    const rows = organizationId
      ? await listDocumentLetterheads(organizationId)
      : [];
    return {
      defaultLetterhead,
      library: rows.flatMap((row) => libraryLetterheadToCandidate(row) ?? []),
    };
  } catch (error) {
    console.error("Failed to list letterhead candidates:", error);
    return { defaultLetterhead: null, library: [] };
  }
};

type ChosenLetterhead = {
  selection: LetterheadSelection;
  letterhead: DocumentLetterhead | null;
};

/**
 * Apply the letterhead the chat model chose when creating a document:
 * "default", "none" or a library letterhead id. The choice is untrusted model
 * output — a library id is honored only when it belongs to the project's
 * organization and has something to render; anything else falls back to the
 * default. A non-default choice is stored before the document's first save
 * (the selection table has no document FK, and {@link resolveSelection}
 * ignores the row until the document belongs to the project). Never throws:
 * document generation must not fail on the letterhead.
 */
export const chooseDocumentLetterhead = async ({
  projectId,
  documentId,
  choice,
  userId,
}: {
  projectId: string;
  documentId: string;
  choice?: string;
  userId?: string | null;
}): Promise<ChosenLetterhead> => {
  const chooseDefault = async (): Promise<ChosenLetterhead> => ({
    selection: "default",
    letterhead: await getProjectLetterheadSafe(projectId),
  });

  try {
    const selection = normalizeLetterheadChoice(choice);
    if (selection === "default") {
      return await chooseDefault();
    }

    if (selection === "none") {
      await upsertDocumentLetterheadSelection({
        documentId,
        letterheadId: null,
        updatedBy: userId ?? null,
      });
      return { selection, letterhead: null };
    }

    const [library, organizationId] = await Promise.all([
      getDocumentLetterheadById(selection),
      getOrganizationIdForProject(projectId),
    ]);
    const letterhead =
      library && libraryLetterheadToDocumentLetterhead(library);
    if (
      !letterhead ||
      effectiveSelection(selection, library?.organizationId, organizationId) !==
        selection
    ) {
      return await chooseDefault();
    }

    await upsertDocumentLetterheadSelection({
      documentId,
      letterheadId: selection,
      updatedBy: userId ?? null,
    });
    return { selection, letterhead };
  } catch (error) {
    console.error("Failed to choose document letterhead:", error);
    return chooseDefault();
  }
};

/**
 * Resolve everything a rendered project document is branded with: letterhead
 * logo, footer, accent color, and the structured letterhead prepended to
 * `content` (unless the content already opens with its own letterhead table).
 * With a `documentId` the document's letterhead selection applies — "none"
 * drops both the letterhead and its logo. A banner letterhead adds no table;
 * it comes back as `logoPlacement: "banner"` with the graphic as `logo`. A
 * grid letterhead adds no table either: it comes back as `gridLetterhead`
 * (the public grid + its logos by cell `index`) for the exporter to draw,
 * with `logo` only as the margin logo of a grid without logo cells. See
 * {@link planLetterheadBranding} for the exact rules.
 */
export async function getProjectDocumentBranding(
  projectId: string,
  content: string,
  documentId?: string,
): Promise<{
  content: string;
  logo: ImageBytes | null;
  footer: Awaited<ReturnType<typeof getProjectFooter>>;
  logoPlacement: LetterheadLogoPlacement | undefined;
  color: string | null;
  gridLetterhead: {
    grid: PublicGridLetterhead;
    logos: (ImageBytes | null)[];
  } | null;
}> {
  const [{ letterhead, logo, logos }, footer] = await Promise.all([
    // An export never fails on its letterhead: without one it keeps its
    // footer and goes out unbranded.
    resolveDocumentLetterhead(projectId, documentId).catch((error: unknown) => {
      console.error("[branding] Letterhead resolution failed:", {
        error: errorName(error),
      });
      return { letterhead: null, logo: null, logos: [] };
    }),
    getProjectFooter(projectId),
  ]);

  const plan = planLetterheadBranding(
    content,
    letterhead && toPublicDocumentLetterhead(letterhead),
    logo !== null,
  );

  return {
    content: plan.content,
    logo: plan.keepLogo ? logo : null,
    footer,
    logoPlacement: plan.logoPlacement,
    color: plan.color,
    gridLetterhead: plan.grid ? { grid: plan.grid, logos } : null,
  };
}

/**
 * Get project by slug (checks both current and historical slugs)
 * Returns the project and whether it was found via historical slug
 */
export async function getProjectBySlug(
  organizationSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<SlugLookupResult<Project>> {
  try {
    const [result] = await db
      .select({ project })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(
        and(
          eq(organization.slug, organizationSlug),
          eq(office.slug, officeSlug),
          isNull(project.deletedAt),
          or(
            eq(project.slug, projectSlug),
            sql`${project.slugHistory}::jsonb @> ${JSON.stringify([projectSlug])}::jsonb`,
          ),
        ),
      );

    if (!result?.project) {
      return { entity: null, foundViaHistory: false };
    }

    // Check if found via history (current slug doesn't match)
    const foundViaHistory = result.project.slug !== projectSlug;

    return { entity: result.project, foundViaHistory };
  } catch (error) {
    console.error("Failed to get project by slug from database");
    throw error;
  }
}

/**
 * Check if a project slug already exists within an office (in current slug or slugHistory)
 * Uses single query to check both. Optionally exclude a specific project ID (for updates)
 */
async function isProjectSlugTaken(
  officeId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(project)
    .where(
      and(
        eq(project.officeId, officeId),
        or(
          eq(project.slug, slug),
          sql`${project.slugHistory}::jsonb @> ${JSON.stringify([slug])}::jsonb`,
        ),
      ),
    );

  if (existing && existing.id !== excludeId) {
    return true;
  }
  return false;
}

/**
 * Generate a unique slug for a project within an office
 * If the base slug is taken or reserved, appends a short unique ID
 */
export async function generateUniqueProjectSlug(
  officeId: string,
  name: string,
): Promise<string> {
  return generateAvailableSlug("project", name, (slug) =>
    isProjectSlugTaken(officeId, slug),
  );
}

/**
 * Fetch aggregated task counts (total and completed) for a list of project IDs.
 * Returns a Map keyed by projectId.
 */
async function getTaskCountsByProjectIds(
  projectIds: string[],
): Promise<Map<string, { total: number; completed: number }>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const counts = await db
    .select({
      projectId: milestones.projectId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
    })
    .from(tasks)
    .innerJoin(milestones, eq(tasks.milestoneId, milestones.id))
    .where(inArray(milestones.projectId, projectIds))
    .groupBy(milestones.projectId);

  return new Map(
    counts.map((c) => [
      c.projectId!,
      { total: c.total, completed: c.completed },
    ]),
  );
}

/**
 * Enrich an array of projects with taskCount and completedTaskCount fields.
 */
function enrichWithTaskCounts<T extends { id: string }>(
  projects: T[],
  countMap: Map<string, { total: number; completed: number }>,
): (T & { taskCount: number; completedTaskCount: number })[] {
  return projects.map((p) => ({
    ...p,
    taskCount: countMap.get(p.id)?.total ?? 0,
    completedTaskCount: countMap.get(p.id)?.completed ?? 0,
  }));
}

export async function getProjectsByOffice(
  officeId: string,
  options: {
    status?: ProjectStatus;
    isTemplate?: boolean;
    isPublic?: boolean;
    offset?: number;
    limit?: number;
    sortBy?: "name" | "createdAt" | "updatedAt" | "status";
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<ProjectWithCoverImage[]> {
  try {
    // Build conditions
    const conditions = [
      eq(project.officeId, officeId),
      isNull(project.deletedAt),
    ];

    if (options.status) {
      conditions.push(eq(project.status, options.status));
    }

    if (typeof options.isTemplate === "boolean") {
      conditions.push(eq(project.isTemplate, options.isTemplate));
    }

    if (typeof options.isPublic === "boolean") {
      conditions.push(eq(project.isPublic, options.isPublic));
    }

    // Determine sorting
    const { sortBy = "createdAt", sortOrder = "desc" } = options;
    const sortFn = sortOrder === "asc" ? asc : desc;

    let orderByClause;
    switch (sortBy) {
      case "name":
        orderByClause = sortFn(project.name);
        break;
      case "status":
        orderByClause = sortFn(project.status);
        break;
      case "updatedAt":
        orderByClause = sortFn(project.updatedAt);
        break;
      default:
        orderByClause = sortFn(project.createdAt);
        break;
    }

    // Build the complete query with left join for cover image
    const baseQuery = db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
      })
      .from(project)
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(orderByClause);

    // Apply pagination conditionally
    let projects;
    if (
      typeof options.offset === "number" &&
      typeof options.limit === "number"
    ) {
      projects = await baseQuery.offset(options.offset).limit(options.limit);
    } else if (typeof options.offset === "number") {
      projects = await baseQuery.offset(options.offset);
    } else if (typeof options.limit === "number") {
      projects = await baseQuery.limit(options.limit);
    } else {
      projects = await baseQuery;
    }

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get projects by office from database");
    throw error;
  }
}

export async function getProjectsCreatedByUser(
  userId: string,
): Promise<UserProject[]> {
  try {
    const projects = await db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
        officeSlug: office.slug,
        officeName: office.name,
        orgSlug: organization.slug,
        orgName: organization.name,
      })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(
        and(
          eq(project.createdBy, userId),
          eq(project.isTemplate, false),
          isNull(project.deletedAt),
          or(
            exists(
              db
                .select({ one: sql`1` })
                .from(organizationUsers)
                .where(
                  and(
                    eq(organizationUsers.userId, userId),
                    eq(organizationUsers.organizationId, organization.id),
                  ),
                ),
            ),
            exists(
              db
                .select({ one: sql`1` })
                .from(officeUsers)
                .where(
                  and(
                    eq(officeUsers.userId, userId),
                    eq(officeUsers.officeId, project.officeId),
                  ),
                ),
            ),
            exists(
              db
                .select({ one: sql`1` })
                .from(projectUsers)
                .where(
                  and(
                    eq(projectUsers.userId, userId),
                    eq(projectUsers.projectId, project.id),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(project.updatedAt));

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get projects created by user from database");
    throw error;
  }
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<Project> {
  try {
    return db.transaction(async (transaction) => {
      const now = new Date();

      // Calculate default end date (180 days from now)
      const defaultEndDate = new Date(now);
      defaultEndDate.setDate(defaultEndDate.getDate() + 180);

      // Create the project first
      const [newProject] = await transaction
        .insert(project)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description,
          prompt: data.prompt,
          officeId: data.officeId,
          createdBy: data.createdBy,
          lastModifiedBy: data.createdBy,
          isTemplate: data.isTemplate || false,
          isPublic: data.isPublic || false,
          parentProjectId: data.parentProjectId,
          status: data.status || "active",
          ...(data.ownershipStatus
            ? { ownershipStatus: data.ownershipStatus }
            : {}),
          ...(data.isResearchPhaseCompleted
            ? { isResearchPhaseCompleted: true }
            : {}),
          startDate: now,
          endDate: defaultEndDate,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Automatically assign the creator as owner in the join table
      await transaction.insert(projectUsers).values({
        userId: data.createdBy,
        projectId: newProject.id,
        role: "owner",
      });

      return newProject;
    });
  } catch (error) {
    console.error("Failed to create project in database:", error);
    throw error;
  }
}

export async function updateProject(data: UpdateProjectRequest): Promise<void> {
  try {
    // Validate slug format if provided
    if (data.slug !== undefined && !isValidSlug(data.slug)) {
      throw new Error(`Invalid slug format: "${data.slug}"`);
    }
    if (data.slug !== undefined) {
      assertSlugNotReserved("project", data.slug);
    }

    // Use transaction to prevent race conditions during slug updates
    await db.transaction(async (tx) => {
      const updateData: Partial<typeof project.$inferInsert> = {
        updatedAt: new Date(),
        lastModifiedBy: data.lastModifiedBy,
      };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.prompt !== undefined) {
        updateData.prompt = data.prompt;
      }

      if (data.isTemplate !== undefined) {
        updateData.isTemplate = data.isTemplate;
      }

      if (data.isPublic !== undefined) {
        updateData.isPublic = data.isPublic;
      }

      if (data.status !== undefined) {
        updateData.status = data.status;
      }

      if (data.startDate !== undefined) {
        updateData.startDate = data.startDate;
      }

      if (data.endDate !== undefined) {
        updateData.endDate = data.endDate;
      }

      // Handle slug change with history tracking
      if (data.slug !== undefined) {
        const [current] = await tx
          .select()
          .from(project)
          .where(and(eq(project.id, data.id), isNull(project.deletedAt)));

        if (current && current.slug !== data.slug) {
          // Check if new slug is available (excluding self)
          const isTaken = await isProjectSlugTaken(
            current.officeId,
            data.slug,
            data.id,
          );
          if (isTaken) {
            throw new Error(
              `Slug "${data.slug}" is already taken or was previously used`,
            );
          }

          // Add current slug to history (unless it's already there)
          const updatedHistory = current.slugHistory.includes(current.slug)
            ? current.slugHistory
            : [...current.slugHistory, current.slug];

          // Remove new slug from history if it exists (returning to a previous slug)
          const finalHistory = updatedHistory.filter((s) => s !== data.slug);

          updateData.slug = data.slug;
          updateData.slugHistory = finalHistory;
        } else if (current) {
          updateData.slug = data.slug;
        }
      }

      await tx
        .update(project)
        .set(updateData)
        .where(and(eq(project.id, data.id), isNull(project.deletedAt)));
    });
  } catch (error) {
    console.error("Failed to update project in database");
    throw error;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await db.delete(project).where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to delete project from database");
    throw error;
  }
}

export async function softDeleteProject(
  id: string,
  lastModifiedBy: string,
): Promise<void> {
  try {
    await db
      .update(project)
      .set({
        deletedAt: new Date(),
        status: "archived",
        lastModifiedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(project.id, id), isNull(project.deletedAt)));
  } catch (error) {
    console.error("Failed to soft delete project from database");
    throw error;
  }
}

// Every office column but its default letterhead grid: the office goes out in
// project payloads (GET /api/projects/:id and the project updates).
const projectOfficeColumns = withoutLetterheadGrid(getTableColumns(office));

export async function getProjectWithRelations(id: string) {
  try {
    const result = await db
      .select({
        project: project,
        office: projectOfficeColumns,
        creator: user,
      })
      .from(project)
      .leftJoin(office, eq(project.officeId, office.id))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(and(eq(project.id, id), isNull(project.deletedAt)));

    return result[0] || null;
  } catch (error) {
    console.error("Failed to get project with relations from database");
    throw error;
  }
}

/**
 * Check if a user has access to a project
 * Uses the RBAC hierarchy so access inherited from organization or office
 * membership is respected, not just direct project membership.
 */
export async function checkUserProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  try {
    const projectExists = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
      .limit(1);

    if (projectExists.length === 0) {
      return false;
    }

    const rbacService = getRBACService();
    const role = await rbacService.getEffectiveRole(
      userId,
      projectId,
      EntityType.PROJECT,
    );
    return role !== null;
  } catch (error) {
    console.error("Failed to check user project access:", error);
    return false;
  }
}

/**
 * Get all projects a user has access to via RBAC for a given office
 * Includes projects where user has:
 * - Direct project membership
 * - Office membership (downward access to all projects in the office)
 * - Organization membership (downward access to all projects in all offices of the org)
 */
export async function getUserAccessibleProjects(
  userId: string,
  officeId: string,
): Promise<ProjectWithCoverImage[]> {
  try {
    // Run office lookup and memberships fetch in parallel
    const rbacService = getRBACService();
    const [officeData, allMemberships] = await Promise.all([
      db
        .select({
          office: office,
          organization: organization,
        })
        .from(office)
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(eq(office.id, officeId))
        .limit(1),
      rbacService.getUserMemberships(userId),
    ]);

    if (officeData.length === 0) {
      return [];
    }

    const organizationId = officeData[0].organization.id;

    // Check if user has organization membership - if so, they can see all projects
    const hasOrgMembership = allMemberships.some(
      (m) =>
        m.entityId === organizationId &&
        m.entityType === EntityType.ORGANIZATION,
    );

    if (hasOrgMembership) {
      // User has organization access, return all projects in this office
      const allProjects = await getProjectsByOffice(officeId);
      return allProjects;
    }

    // Check if user has office membership - if so, they can see all projects in that office
    const hasOfficeMembership = allMemberships.some(
      (m) => m.entityId === officeId && m.entityType === EntityType.OFFICE,
    );

    if (hasOfficeMembership) {
      // User has office access, return all projects in this office
      return await getProjectsByOffice(officeId);
    }

    // Batch: Collect all direct project IDs
    const directProjectIds = allMemberships
      .filter((m) => m.entityType === EntityType.PROJECT)
      .map((m) => m.entityId);

    // Single query: Fetch all direct projects and filter by office
    if (directProjectIds.length === 0) {
      return [];
    }

    const projects = await db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
      })
      .from(project)
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(
        and(
          inArray(project.id, directProjectIds),
          eq(project.officeId, officeId),
          isNull(project.deletedAt),
        ),
      );

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get accessible projects from database:", error);
    throw error;
  }
}

async function copyProjectContentToTarget(
  tx: typeof db,
  sourceProjectId: string,
  targetProjectId: string,
  userId: string,
  options?: {
    dateOffsetMs?: number;
    /** Module names whose content must not be copied (see template-copy-policy). */
    excludedModules?: readonly string[];
  },
): Promise<void> {
  const dateOffsetMs = options?.dateOffsetMs ?? 0;
  const scope = resolveTemplateCopyScope(options?.excludedModules);
  const shiftDate = (date: Date): Date =>
    new Date(date.getTime() + dateOffsetMs);

  // Copy project fields
  const sourceFields = scope.fields
    ? await tx
        .select()
        .from(projectField)
        .where(eq(projectField.projectId, sourceProjectId))
    : [];

  if (sourceFields.length > 0) {
    await tx.insert(projectField).values(
      sourceFields.map((f) => ({
        projectId: targetProjectId,
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        tooltip: f.tooltip,
        order: f.order,
        values: f.values,
      })),
    );
  }

  // Fetch milestones/tasks from source
  const sourceMilestones = scope.tasks
    ? await tx
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, sourceProjectId))
    : [];

  const sourceTasks =
    sourceMilestones.length > 0
      ? await tx
          .select()
          .from(tasks)
          .where(
            inArray(
              tasks.milestoneId,
              sourceMilestones.map((m) => m.id),
            ),
          )
      : [];

  // Copy referenced docs and remap IDs
  const documentIdMap = new Map<string, string>();
  const uniqueDocumentIds = new Set<string>();

  for (const m of sourceMilestones) {
    if (m.documentId) uniqueDocumentIds.add(m.documentId);
  }
  for (const t of sourceTasks) {
    if (t.documentId) uniqueDocumentIds.add(t.documentId);
  }

  for (const docId of uniqueDocumentIds) {
    const [latestDoc] = await tx
      .select()
      .from(document)
      .where(eq(document.id, docId))
      .orderBy(desc(document.createdAt))
      .limit(1);

    if (latestDoc) {
      const [newDoc] = await tx
        .insert(document)
        .values({
          createdAt: new Date(),
          title: latestDoc.title,
          content: latestDoc.content,
          kind: latestDoc.kind,
          userId,
        })
        .returning();
      documentIdMap.set(docId, newDoc.id);
    }
  }

  // Copy milestones and keep ID map for tasks
  const milestoneIdMap = new Map<string, string>();

  for (const src of sourceMilestones) {
    const [inserted] = await tx
      .insert(milestones)
      .values({
        title: src.title,
        assigneeIds: [],
        startDate: shiftDate(src.startDate),
        dueDate: shiftDate(src.dueDate),
        status: src.status,
        order: src.order,
        documentId: src.documentId
          ? (documentIdMap.get(src.documentId) ?? src.documentId)
          : src.documentId,
        projectId: targetProjectId,
        userId,
      })
      .returning();
    milestoneIdMap.set(src.id, inserted.id);
  }

  // Copy tasks in two passes so dependencies are remapped correctly
  const taskIdMap = new Map<string, string>();
  for (const src of sourceTasks) {
    const [inserted] = await tx
      .insert(tasks)
      .values({
        title: src.title,
        description: src.description,
        assigneeIds: [],
        dependencies: [],
        startDate: shiftDate(src.startDate),
        dueDate: shiftDate(src.dueDate),
        status: src.status,
        order: src.order,
        milestoneId: milestoneIdMap.get(src.milestoneId) ?? src.milestoneId,
        documentId: src.documentId
          ? (documentIdMap.get(src.documentId) ?? src.documentId)
          : src.documentId,
        userId,
      })
      .returning();
    taskIdMap.set(src.id, inserted.id);
  }

  for (const sourceTask of sourceTasks) {
    if (!sourceTask.dependencies || sourceTask.dependencies.length === 0) {
      continue;
    }

    const newTaskId = taskIdMap.get(sourceTask.id);
    const remappedDeps = sourceTask.dependencies
      .map((depId) => taskIdMap.get(depId))
      .filter((id): id is string => id !== undefined);

    if (newTaskId && remappedDeps.length > 0) {
      await tx
        .update(tasks)
        .set({ dependencies: remappedDeps })
        .where(eq(tasks.id, newTaskId));
    }
  }

  // Copy project documents (share blob URLs)
  const sourceDocuments = (
    await tx
      .select()
      .from(projectDocument)
      .where(eq(projectDocument.projectId, sourceProjectId))
  ).filter((d) => isProjectDocumentInScope(d.source, scope));

  if (sourceDocuments.length > 0) {
    await tx.insert(projectDocument).values(
      sourceDocuments.map((d) => ({
        projectId: targetProjectId,
        userId,
        filename: d.filename,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        size: d.size,
        url: d.url,
        // Preserve origin + research metadata so duplicated research docs stay
        // on the Context page (not the Documents page).
        source: d.source,
        relevance: d.relevance,
        context: d.context,
        folder: d.folder,
        folderDescription: d.folderDescription,
        // The analysis describes the shared file (its logo keys are shared
        // too): copying it spares a paid re-analysis and duplicate logos.
        letterheadStatus: d.letterheadStatus,
        letterheadAnalysis: d.letterheadAnalysis,
      })),
    );
  }
}

/**
 * Create a template from an existing project by duplicating core project data.
 */
export async function createTemplateFromProject(
  sourceProjectId: string,
  userId: string,
  isPublic: boolean,
  overrides?: { name?: string; description?: string },
): Promise<Project> {
  try {
    return db.transaction(async (tx) => {
      const [sourceProject] = await tx
        .select()
        .from(project)
        .where(and(eq(project.id, sourceProjectId), isNull(project.deletedAt)));

      if (!sourceProject) {
        throw new Error(`Source project ${sourceProjectId} not found`);
      }

      const templateName = overrides?.name || `Template: ${sourceProject.name}`;
      const slug = await generateUniqueProjectSlug(
        sourceProject.officeId,
        templateName,
      );

      const now = new Date();
      const [newTemplate] = await tx
        .insert(project)
        .values({
          name: templateName,
          slug,
          description: overrides?.description ?? sourceProject.description,
          officeId: sourceProject.officeId,
          createdBy: userId,
          lastModifiedBy: userId,
          isTemplate: true,
          parentProjectId: sourceProjectId,
          isPublic,
          status: sourceProject.status,
          hiddenModules: sourceProject.hiddenModules,
          privateModules: sourceProject.privateModules,
          moduleOrder: sourceProject.moduleOrder,
          startDate: sourceProject.startDate,
          endDate: sourceProject.endDate,
          coverImageId: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(projectUsers).values({
        userId,
        projectId: newTemplate.id,
        role: "owner",
      });

      await copyProjectContentToTarget(
        tx,
        sourceProjectId,
        newTemplate.id,
        userId,
      );

      return newTemplate;
    });
  } catch (error) {
    console.error("Failed to create template from project:", error);
    throw error;
  }
}

export async function getEmptyStateSuggestions({
  projectId,
  section,
}: {
  projectId: string;
  section: "tasks" | "documents";
}) {
  return db
    .select()
    .from(emptyStateSuggestion)
    .where(
      and(
        eq(emptyStateSuggestion.projectId, projectId),
        eq(emptyStateSuggestion.section, section),
      ),
    )
    .orderBy(asc(emptyStateSuggestion.orderIndex));
}

export async function saveEmptyStateSuggestions(
  suggestions: NewEmptyStateSuggestion[],
) {
  return db.insert(emptyStateSuggestion).values(suggestions).returning();
}

export async function getOrGenerateEmptyStateSuggestions({
  projectId,
  section,
}: {
  projectId: string;
  section: "tasks" | "documents";
}) {
  const existing = await getEmptyStateSuggestions({ projectId, section });

  if (existing.length > 0) {
    return existing;
  }

  const proj = await getProjectById(projectId);
  if (!proj) {
    throw new Error("Project not found");
  }

  // Credit gate: garnish content — a hard-stopped org gets no suggestions
  // instead of a free model call.
  const billingOrgId = await resolveBillingOrgForProject(projectId);
  if (billingOrgId) {
    try {
      await assertCreditsAvailable(billingOrgId);
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        return [];
      }
      throw error;
    }
  }

  const model = await getModel("lite");

  const sanitize = (input: string) =>
    input.replace(/[[\]{}]/g, "").slice(0, 200);

  const systemPrompt = await getPrompt("empty-state-suggestions", {
    section,
    projectName: sanitize(proj.name),
    projectDescription: sanitize(proj.description || "No description provided"),
  });

  const generation = await generateText({
    model,
    system: systemPrompt,
    prompt: `Generate 3 suggestion pills for the "${section}" section.`,
  });
  const suggestionsText = generation.text;

  await meterAiCall({
    billing: billingOrgId ? { organizationId: billingOrgId } : null,
    source: "suggestion",
    usage: generation.usage,
    providerMetadata: generation.providerMetadata,
    metadata: { tool: "emptyStateSuggestions", projectId, section },
  });

  let parsed: unknown;
  try {
    const cleaned = suggestionsText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      "[empty-state-suggestions] Failed to parse AI response:",
      suggestionsText,
    );
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(
      "[empty-state-suggestions] Invalid suggestions structure:",
      parsed,
    );
    return [];
  }

  const suggestions = parsed
    .filter(
      (s): s is { label: string; content: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof s.label === "string" &&
        typeof s.content === "string" &&
        s.label.length > 0 &&
        s.content.length > 0,
    )
    .slice(0, 3);

  if (suggestions.length === 0) {
    console.error(
      "[empty-state-suggestions] No valid suggestions in response:",
      parsed,
    );
    return [];
  }

  // Re-check for duplicates before inserting (guards against concurrent requests)
  const recheck = await getEmptyStateSuggestions({ projectId, section });
  if (recheck.length > 0) {
    return recheck;
  }

  const saved = await saveEmptyStateSuggestions(
    suggestions.map((s, index) => ({
      projectId,
      section,
      label: s.label,
      content: s.content,
      orderIndex: index,
    })),
  );

  return saved;
}
/**
 * Create a project from an existing template by duplicating core template data.
 */
export async function createProjectFromTemplate(
  templateProjectId: string,
  userId: string,
  targetOfficeId: string,
  overrides?: {
    name?: string;
    description?: string;
    /** Saved default submit-for-review target (not submitted at creation). */
    intendedSubmissionOrganizationId?: string | null;
    intendedSubmissionOfficeId?: string | null;
    /**
     * Module names whose content must not be copied — the template's
     * hidden/private modules when the caller reached it only because it is
     * public (no project role).
     */
    excludedModules?: readonly string[];
  },
): Promise<Project> {
  try {
    return db.transaction(async (tx) => {
      const [sourceTemplate] = await tx
        .select()
        .from(project)
        .where(
          and(eq(project.id, templateProjectId), isNull(project.deletedAt)),
        );

      if (!sourceTemplate) {
        throw new Error(`Template ${templateProjectId} not found`);
      }

      if (!sourceTemplate.isTemplate) {
        throw new Error(`Project ${templateProjectId} is not a template`);
      }

      const normalizedTemplateName = sourceTemplate.name
        .replace(/^Template:\s*/i, "")
        .trim();
      const projectName =
        overrides?.name?.trim() ||
        normalizedTemplateName ||
        sourceTemplate.name;
      const slug = await generateUniqueProjectSlug(targetOfficeId, projectName);

      const now = new Date();
      const templateStartDate =
        sourceTemplate.startDate ?? sourceTemplate.createdAt;
      const templateEndDate =
        sourceTemplate.endDate ??
        sourceTemplate.startDate ??
        sourceTemplate.createdAt;
      const templateDurationMs = Math.max(
        0,
        templateEndDate.getTime() - templateStartDate.getTime(),
      );
      const shiftedProjectStartDate = now;
      const shiftedProjectEndDate = new Date(
        now.getTime() + templateDurationMs,
      );
      const dateOffsetMs =
        shiftedProjectStartDate.getTime() - templateStartDate.getTime();

      const [newProject] = await tx
        .insert(project)
        .values({
          name: projectName,
          slug,
          description: overrides?.description ?? sourceTemplate.description,
          officeId: targetOfficeId,
          createdBy: userId,
          lastModifiedBy: userId,
          isTemplate: false,
          parentProjectId: templateProjectId,
          isPublic: false,
          status: sourceTemplate.status,
          hiddenModules: sourceTemplate.hiddenModules,
          privateModules: sourceTemplate.privateModules,
          moduleOrder: sourceTemplate.moduleOrder,
          startDate: shiftedProjectStartDate,
          endDate: shiftedProjectEndDate,
          coverImageId: null,
          intendedSubmissionOrganizationId:
            overrides?.intendedSubmissionOrganizationId ?? null,
          intendedSubmissionOfficeId:
            overrides?.intendedSubmissionOfficeId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(projectUsers).values({
        userId,
        projectId: newProject.id,
        role: "owner",
      });

      await copyProjectContentToTarget(
        tx,
        templateProjectId,
        newProject.id,
        userId,
        { dateOffsetMs, excludedModules: overrides?.excludedModules },
      );

      return newProject;
    });
  } catch (error) {
    console.error("Failed to create project from template:", error);
    throw error;
  }
}
