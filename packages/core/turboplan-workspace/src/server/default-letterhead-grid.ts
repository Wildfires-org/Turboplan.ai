// An office's or organization's default letterhead grid
// (`document_letterhead_grid`): reading it as the client may see it (logo
// cells by `index`, never a storage key) with its version, serving one of its
// logos, editing it with the letterhead editor, and saving a document's own
// copy of its reference's letterhead as the default ("Save as organization
// letterhead"). The grid's logo objects are shared with the copies they came
// from (content-addressed `letterheads/…` keys or the editor's uploads) and
// are never deleted here.

import {
  type DefaultLetterheadGridOwner,
  getDefaultLetterheadGrid,
  getDocumentOwnLetterhead,
  getOrganizationIdForProject,
  getProjectIdByDocumentId,
  setDefaultLetterheadGrid,
} from "@wildfires-org/turboplan-db/queries";
import { ownedUploadKey } from "@wildfires-org/turboplan-upload/server";

import {
  type LetterheadLayout,
  libraryLetterheadToDocumentLetterhead,
  normalizeLetterheadColor,
} from "../letterhead";
import {
  type GridLetterhead,
  type PublicGridLetterhead,
  strictGridLetterheadSchema,
  usableGridLetterhead,
} from "../letterhead-grid";
import {
  applyGridLetterheadEdit,
  type GridLetterheadEdit,
} from "../letterhead-grid-edit";
import {
  gridLogoCells,
  toPublicGridLetterhead,
} from "../letterhead-grid-layout";
import { type ImageBytes, readLetterheadImage } from "./letterhead-image";
import { getOfficeById } from "./offices/queries";
import { getProjectById } from "./projects/queries";

export type { DefaultLetterheadGridOwner };

const NOT_FOUND = { ok: false, reason: "not_found" } as const;
const CONFLICT = { ok: false, reason: "conflict" } as const;

// What an edit of an owner without a (usable) grid starts from: no logo to
// keep by index, so only text columns and new uploads.
const EMPTY_GRID: GridLetterhead = { cells: [], color: null };

// JSON with every object's keys sorted, so the same stored value always gives
// the same text — whatever key order the driver or the writer used.
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

/**
 * The version of an owner's stored default grid, as `GET …/letterhead-grid`
 * sends it and `PUT …/letterhead-grid` expects it back: the first 16 hex
 * characters of the SHA-256 of the stored value's (canonical) JSON — usable
 * or not — or null when no grid is set. Any change to the stored grid
 * changes it, so an edit made on an older grid (whose logo indexes may mean
 * other logos now) is refused.
 */
export const defaultLetterheadGridVersion = async (
  stored: unknown,
): Promise<string | null> => {
  if (stored === null || stored === undefined) {
    return null;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(stored)),
  );
  return Array.from(new Uint8Array(digest).subarray(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

/**
 * The owner's default grid as it renders — validated and clipped like every
 * resolver (`usableGridLetterhead`), so logo `index`es here are the ones the
 * client is given — with `grid: null` when none is set or it is unusable;
 * null when the owner does not exist.
 */
const usableDefaultGrid = async (
  owner: DefaultLetterheadGridOwner,
): Promise<{ grid: GridLetterhead | null } | null> => {
  const row = await getDefaultLetterheadGrid(owner);
  return row && { grid: usableGridLetterhead(row.grid) };
};

/** A default grid as the client may see it, with the version it was read at. */
export type PublicDefaultLetterheadGrid = {
  // Null when none is set or it cannot render.
  grid: PublicGridLetterhead | null;
  // See `defaultLetterheadGridVersion`.
  version: string | null;
};

/**
 * The owner's default grid as the client may see it (logo cells by `index`)
 * and its version; null when the owner does not exist.
 */
export const getPublicDefaultLetterheadGrid = async (
  owner: DefaultLetterheadGridOwner,
): Promise<PublicDefaultLetterheadGrid | null> => {
  const row = await getDefaultLetterheadGrid(owner);
  if (!row) {
    return null;
  }
  const grid = usableGridLetterhead(row.grid);
  return {
    grid: grid && toPublicGridLetterhead(grid),
    version: await defaultLetterheadGridVersion(row.grid),
  };
};

/**
 * The bytes of the default grid's logo at `index` (`gridLogoCells` order),
 * read by its object key (`readLetterheadImage`); null without a grid, past
 * its last logo, and for a logo that does not load.
 */
export const getDefaultLetterheadGridLogo = async (
  owner: DefaultLetterheadGridOwner,
  index: number,
): Promise<ImageBytes | null> => {
  const stored = await usableDefaultGrid(owner);
  const cell = stored?.grid ? gridLogoCells(stored.grid)[index] : undefined;
  return cell ? readLetterheadImage({ key: cell.key }) : null;
};

// Whether the (not deleted) project sits under the owner: in that office, or
// in an office of that organization.
const isProjectUnderOwner = async (
  owner: DefaultLetterheadGridOwner,
  projectId: string,
): Promise<boolean> => {
  const [project, organizationId] = await Promise.all([
    getProjectById(projectId),
    owner.kind === "organization"
      ? getOrganizationIdForProject(projectId)
      : null,
  ]);
  if (!project) {
    return false;
  }
  return owner.kind === "office"
    ? project.officeId === owner.id
    : organizationId === owner.id;
};

export type SaveDocumentLetterheadAsDefaultResult =
  // `version`: the owner's grid's new version.
  | { ok: true; grid: PublicGridLetterhead; version: string | null }
  | { ok: false; reason: "not_found" };

/**
 * Make a document's own copy of its reference's letterhead the owner's
 * default letterhead grid. The copy's stored grid (logo keys included, so
 * the default shares the copy's logo objects) is written as it renders —
 * validated, clipped, held to `strictGridLetterheadSchema`, its base text
 * size kept — and only its public form is returned, with the new version. Unconditional: saving
 * replaces whatever grid the owner had. One `not_found` (never which check
 * failed) when the project is not under the owner or is deleted, the
 * document is not in the project, it has no copy that validates, or the
 * owner no longer exists.
 */
export const saveDocumentLetterheadAsDefault = async ({
  owner,
  projectId,
  documentId,
}: {
  owner: DefaultLetterheadGridOwner;
  projectId: string;
  documentId: string;
}): Promise<SaveDocumentLetterheadAsDefaultResult> => {
  const [isUnderOwner, documentProjectId] = await Promise.all([
    isProjectUnderOwner(owner, projectId),
    getProjectIdByDocumentId({ id: documentId }),
  ]);
  // Checked first: the copy is keyed by document id only.
  if (!isUnderOwner || documentProjectId !== projectId) {
    return NOT_FOUND;
  }

  const copy = await getDocumentOwnLetterhead(documentId);
  const usable = copy && usableGridLetterhead(copy.letterhead);
  const parsed = usable && strictGridLetterheadSchema.safeParse(usable);
  if (!parsed?.success) {
    return NOT_FOUND;
  }

  const grid: GridLetterhead = {
    cells: parsed.data.cells,
    color: normalizeLetterheadColor(parsed.data.color),
    ...(parsed.data.fontSize !== undefined
      ? { fontSize: parsed.data.fontSize }
      : {}),
  };
  const written = await setDefaultLetterheadGrid(owner, grid);
  if (!written) {
    return NOT_FOUND;
  }
  return {
    ok: true,
    grid: toPublicGridLetterhead(grid),
    version: await defaultLetterheadGridVersion(written.grid),
  };
};

export type EditDefaultLetterheadGridResult =
  // `version`: the owner's grid's new version.
  | { ok: true; grid: PublicGridLetterhead; version: string | null }
  // The owner does not exist.
  | { ok: false; reason: "not_found" }
  // The stored grid is no longer `version` (changed since the editor read
  // it), so the edit's logo indexes may mean other logos.
  | { ok: false; reason: "conflict" }
  // `field` / `message`: see `applyGridLetterheadEdit`.
  | { ok: false; reason: "invalid"; field: string; message: string };

/**
 * Replace the owner's default grid with the letterhead editor's version (see
 * `applyGridLetterheadEdit`): a kept logo is the stored grid's logo (its
 * key) at that index, a new logo must be an upload of `userId`
 * (`uploads/<userId>/…` under the storage write base) and is stored by its
 * object key (`ownedUploadKey`). An owner without a usable grid gets one
 * (text columns and new uploads only). `version` is the one the editor read
 * (`getPublicDefaultLetterheadGrid`; null: none was set): checked before the
 * edit is applied, and again by the write itself — a compare-and-set on the
 * grid that was read — so of two concurrent edits from the same version only
 * one is saved; the other is a conflict (as is an owner deleted meanwhile).
 */
export const editDefaultLetterheadGrid = async ({
  owner,
  edit,
  version,
  userId,
}: {
  owner: DefaultLetterheadGridOwner;
  edit: GridLetterheadEdit;
  version: string | null;
  userId: string;
}): Promise<EditDefaultLetterheadGridResult> => {
  const row = await getDefaultLetterheadGrid(owner);
  if (!row) {
    return NOT_FOUND;
  }
  // Before the edit is applied: its logo indexes refer to that version.
  if ((await defaultLetterheadGridVersion(row.grid)) !== version) {
    return CONFLICT;
  }

  const result = applyGridLetterheadEdit(
    edit,
    usableGridLetterhead(row.grid) ?? EMPTY_GRID,
    (url) => ownedUploadKey(url, userId),
  );
  if (!result.ok) {
    return { ...result, reason: "invalid" };
  }

  const written = await setDefaultLetterheadGrid(owner, result.grid, {
    ifStored: { grid: row.grid },
  });
  if (!written) {
    return CONFLICT;
  }
  return {
    ok: true,
    grid: toPublicGridLetterhead(result.grid),
    version: await defaultLetterheadGridVersion(written.grid),
  };
};

/**
 * Remove the owner's default grid, so its legacy letterhead fields apply
 * again; false when the owner does not exist. The logo objects stay in
 * storage: document copies may still use them.
 */
export const removeDefaultLetterheadGrid = async (
  owner: DefaultLetterheadGridOwner,
): Promise<boolean> => (await setDefaultLetterheadGrid(owner, null)) !== null;

// Whether an office or organization has a default letterhead of its own —
// a usable grid, or legacy fields with something to render — the rule the
// office → org default resolution applies.
const hasDefaultLetterhead = (entity: {
  documentLetterheadGrid: unknown;
  documentLetterheadLayout: LetterheadLayout | null;
  documentLetterheadLines: string | null;
  documentLetterheadContact: string | null;
  documentLetterheadColor: string | null;
  documentLogoUrl: string | null;
}): boolean =>
  usableGridLetterhead(entity.documentLetterheadGrid) !== null ||
  libraryLetterheadToDocumentLetterhead({
    layout: entity.documentLetterheadLayout,
    lines: entity.documentLetterheadLines,
    contact: entity.documentLetterheadContact,
    logoUrl: entity.documentLogoUrl,
    color: entity.documentLetterheadColor,
  }) !== null;

export type ProjectLetterheadTarget = {
  organizationId: string;
  officeId: string;
  // The project's office has its own default letterhead, which hides the
  // organization's from this project's documents.
  officeHasOwnDefault: boolean;
};

/**
 * Where a project's documents take their default letterhead from: its
 * office and organization, and whether the office has a default of its own.
 * Null for a deleted or unknown project.
 */
export const getProjectLetterheadTarget = async (
  projectId: string,
): Promise<ProjectLetterheadTarget | null> => {
  const project = await getProjectById(projectId);
  const office = project && (await getOfficeById(project.officeId));
  if (!office) {
    return null;
  }
  return {
    organizationId: office.organizationId,
    officeId: office.id,
    officeHasOwnDefault: hasDefaultLetterhead(office),
  };
};
