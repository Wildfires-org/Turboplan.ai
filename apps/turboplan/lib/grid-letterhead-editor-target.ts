// What the grid letterhead editor (`components/grid-letterhead-editor.tsx`)
// edits: a document's own copy of its reference's letterhead, or an
// organization's / office's default grid. The parts that differ — where the
// edit is saved, with which version, and where the saved logos come from —
// are here; the editor itself is the same for both.

import type { GridLetterheadEdit } from "@wildfires-org/turboplan-workspace/types";

import {
  type DefaultLetterheadGridLogoKey,
  defaultLetterheadGridLogoKey,
} from "@/hooks/use-default-letterhead-grid";
import {
  type LetterheadLogoKey,
  letterheadLogoKey,
} from "@/hooks/use-letterhead-logo";
import {
  type DefaultLetterheadGridOwner,
  type DefaultLetterheadGridResponse,
  defaultLetterheadGridUrl,
} from "@/lib/default-letterhead-grid";
import {
  type OwnLetterheadSaveResponse,
  saveDefaultLetterheadGridFetcher,
  saveOwnLetterheadFetcher,
} from "@/lib/export/letterhead";

export type GridLetterheadEditorTarget =
  | {
      kind: "document";
      projectId: string;
      documentId: string;
      // `own.version` of `GET /letterhead` when the editor opened.
      version: string;
    }
  | {
      kind: "default";
      owner: DefaultLetterheadGridOwner;
      // `version` of `GET letterhead-grid` when the editor opened.
      version: string | null;
      // The logo drawn in the margin of a grid without logo cells (the
      // owner's document logo), as documents draw it.
      marginLogoSrc: string | null;
    };

export type GridLetterheadEditorSaved =
  | { kind: "document"; saved: OwnLetterheadSaveResponse }
  | { kind: "default"; saved: DefaultLetterheadGridResponse };

export type GridLetterheadEditorLogoKey =
  | LetterheadLogoKey
  | DefaultLetterheadGridLogoKey;

/** The endpoint the edit is PUT to (the editor's mutation key). */
export const gridEditorSaveUrl = (target: GridLetterheadEditorTarget) =>
  target.kind === "document"
    ? `/api/documents/${target.documentId}/letterhead/own`
    : defaultLetterheadGridUrl(target.owner);

/**
 * Saves the edit with the version the editor opened with — a document's copy
 * with its project — and answers what was saved. Refusals are
 * `LetterheadSaveError`s (409 when the letterhead changed meanwhile, 400 with
 * the edit's `field`).
 */
export const saveGridLetterheadEdit = async (
  target: GridLetterheadEditorTarget,
  edit: GridLetterheadEdit,
): Promise<GridLetterheadEditorSaved> => {
  const url = gridEditorSaveUrl(target);
  if (target.kind === "document") {
    const saved = await saveOwnLetterheadFetcher(url, {
      arg: { projectId: target.projectId, version: target.version, grid: edit },
    });
    return { kind: "document", saved };
  }
  const saved = await saveDefaultLetterheadGridFetcher(url, {
    arg: { grid: edit, version: target.version },
  });
  return { kind: "default", saved };
};

/**
 * Where the saved logo `index` (of `savedLogoCount`) loads from: the
 * document's letterhead-logo proxy, or the owner's settings logo proxy (the
 * settings' cache of the grid at the editor's version); null when there is
 * none to load. A document always loads index 0: for a grid without logo
 * cells it is the office → organization logo drawn in the margin.
 */
export const gridEditorLogoKey = (
  target: GridLetterheadEditorTarget,
  index: number,
  savedLogoCount: number,
): GridLetterheadEditorLogoKey | null => {
  if (target.kind === "document") {
    return index === 0 || index < savedLogoCount
      ? letterheadLogoKey(target.projectId, target.documentId, index)
      : null;
  }
  return index < savedLogoCount
    ? defaultLetterheadGridLogoKey(target.owner, target.version, index)
    : null;
};

/** What a save changes, under the editor's title. */
export const gridEditorDescription = (target: GridLetterheadEditorTarget) => {
  if (target.kind === "document") {
    return "Changes apply to this document only.";
  }
  return target.owner.kind === "organization"
    ? "The default for documents in the organization's projects, unless their office has its own."
    : "The default for documents in this office's projects.";
};
