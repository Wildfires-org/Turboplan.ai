// An organization's or office's default grid letterhead (a document's copy
// saved with "Save as organization letterhead"): its endpoints, where "Save
// as …" goes for a project, and what the settings show. Pure, so it is
// unit-tested; the fetchers are in `lib/export/letterhead*.ts`, the SWR hooks
// in `hooks/use-default-letterhead-grid.ts`.

import {
  type GridLetterheadEdit,
  gridToLines,
  normalizeLetterheadColor,
  type PublicGridDocumentLetterhead,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

export type DefaultLetterheadGridOwner = {
  kind: "organization" | "office";
  id: string;
};

// GET / PUT / POST from-document of `/api/{organizations|offices}/:id/letterhead-grid`.
// `version` identifies the stored grid's state (null while none is set): the
// editor sends it back with its edit, which the server refuses (409) once
// the grid changed meanwhile.
export type DefaultLetterheadGridResponse = {
  grid: PublicGridLetterhead | null;
  version: string | null;
};

// PUT `/api/{organizations|offices}/:id/letterhead-grid`.
export type DefaultLetterheadGridSaveRequest = {
  grid: GridLetterheadEdit;
  version: string | null;
};

// GET `/api/projects/:projectId/letterhead-target`. With
// `officeHasOwnDefault` the project's documents resolve the office's default
// letterhead, which hides the organization's.
export type ProjectLetterheadTarget = {
  organizationId: string;
  officeId: string;
  officeHasOwnDefault: boolean;
  canEditOrganization: boolean;
  canEditOffice: boolean;
};

// Where "Save as … letterhead" writes a document's copy, and what it
// replaces: `hasExistingDefault` is null when that is not known (the
// organization's default while the office's hides it from this project).
// `isHiddenByOffice`: the project's documents keep the office's default.
export type LetterheadSaveTarget = {
  owner: DefaultLetterheadGridOwner;
  hasExistingDefault: boolean | null;
  isHiddenByOffice: boolean;
};

export type SaveAsDefaultLetterheadCopy = {
  actionLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
};

// What the Letterhead block of the org / office settings shows: a
// placeholder while the grid loads, the grid default (with Edit / Remove for
// a user who may change it), or the layout settings as before — also when
// the grid does not load.
export type DefaultLetterheadSettingsView =
  | { kind: "loading" }
  | { kind: "legacy" }
  | {
      kind: "grid";
      grid: PublicGridLetterhead;
      version: string | null;
      canEdit: boolean;
    };

// The words of the settings' grid block: the note under the preview and the
// Remove confirmation.
export type DefaultLetterheadSettingsCopy = {
  note: string;
  removeDescription: string;
};

// Every document whose selection is "Default" resolves the default when it
// is shown or exported, so a change reaches existing documents too.
const KEEP_OWN_NOTE =
  "Documents with their own letterhead or a chosen one keep it.";

export const defaultLetterheadGridUrl = (owner: DefaultLetterheadGridOwner) =>
  `/api/${owner.kind === "organization" ? "organizations" : "offices"}/${owner.id}/letterhead-grid`;

export const projectLetterheadTargetUrl = (projectId: string) =>
  `/api/projects/${projectId}/letterhead-target`;

/** SWR key filter for every project's `letterhead-target` the client holds. */
export const isProjectLetterheadTargetKey = (key: unknown) =>
  typeof key === "string" &&
  /^\/api\/projects\/[^/]+\/letterhead-target$/.test(key);

/**
 * Where "Save as … letterhead" goes for a project's document, or null when
 * the user may change neither default (the action is hidden):
 * - the office, when it has a default of its own (which would hide the
 *   organization's from this project) and the user may change it;
 * - else the organization, when the user may change it;
 * - else the office (its own default from now on), when the user may change
 *   it.
 * `projectHasDefault`: the project resolves a default letterhead today
 * (`GET /letterhead`'s `defaultLetterhead`) — without the office's own, that
 * is the organization's.
 */
export const letterheadSaveTarget = (
  target: ProjectLetterheadTarget,
  projectHasDefault: boolean,
): LetterheadSaveTarget | null => {
  const office = { kind: "office" as const, id: target.officeId };
  if (target.officeHasOwnDefault && target.canEditOffice) {
    return { owner: office, hasExistingDefault: true, isHiddenByOffice: false };
  }
  if (target.canEditOrganization) {
    return {
      owner: { kind: "organization", id: target.organizationId },
      hasExistingDefault: target.officeHasOwnDefault ? null : projectHasDefault,
      isHiddenByOffice: target.officeHasOwnDefault,
    };
  }
  if (target.canEditOffice) {
    return {
      owner: office,
      hasExistingDefault: false,
      isHiddenByOffice: false,
    };
  }
  return null;
};

/**
 * The words of the "Save as … letterhead" action and its confirmation. The
 * default is resolved whenever a document is shown or exported, so every
 * document set to "Default" changes, existing and new; an office without a
 * default of its own (the office target with `hasExistingDefault` false)
 * shows the organization's until then.
 */
export const saveAsDefaultLetterheadCopy = ({
  owner,
  hasExistingDefault,
  isHiddenByOffice,
}: LetterheadSaveTarget): SaveAsDefaultLetterheadCopy => {
  const isOffice = owner.kind === "office";
  const whose = isOffice ? "the office's" : "the organization's";
  const scope = isOffice
    ? "Documents set to “Default” in this office's projects, existing and new,"
    : "Documents set to “Default” in the organization's projects, existing and new,";
  const replaced =
    hasExistingDefault === true
      ? ` instead of ${whose} current letterhead`
      : isOffice
        ? " instead of the organization's letterhead"
        : "";
  const unlessOffice = isOffice
    ? ""
    : " (unless their office has its own letterhead)";
  const notes = [
    `${scope} will use this letterhead${replaced}${unlessOffice}.`,
    hasExistingDefault === null
      ? `It replaces ${whose} current letterhead, if it has one.`
      : null,
    isHiddenByOffice
      ? "This project's office has its own letterhead, so documents here keep using the office's."
      : null,
    KEEP_OWN_NOTE,
  ];
  return {
    actionLabel: `Save as ${isOffice ? "office" : "organization"} letterhead…`,
    title:
      hasExistingDefault === true
        ? `Replace ${whose} letterhead?`
        : `Use this as ${whose} letterhead?`,
    description: notes.filter(Boolean).join(" "),
    confirmLabel: hasExistingDefault === true ? "Replace" : "Save",
    successMessage: `Saved as ${whose} letterhead.`,
  };
};

/**
 * The settings' Letterhead block for the `GET letterhead-grid` state: a
 * placeholder until it first answers (not the layout settings, which a grid
 * would then replace), the grid when one is set, else the layout settings,
 * unchanged — also when it failed. Edit / Remove only with `canEdit`
 * (UPDATE).
 */
export const defaultLetterheadSettingsView = (
  { data, error }: { data?: DefaultLetterheadGridResponse; error?: unknown },
  canEdit: boolean,
): DefaultLetterheadSettingsView => {
  if (data?.grid) {
    return {
      kind: "grid",
      grid: data.grid,
      version: data.version ?? null,
      canEdit,
    };
  }
  return data || error ? { kind: "legacy" } : { kind: "loading" };
};

/**
 * The note and the Remove confirmation of a set grid. Removing it brings
 * back the owner's layout settings when they make a letterhead
 * (`hasLayoutLetterhead`); else an office's documents go back to the
 * organization's letterhead, an organization's to none. As for saving, every
 * document set to "Default" follows.
 */
export const defaultLetterheadSettingsCopy = ({
  ownerKind,
  hasLayoutLetterhead,
  canEdit,
}: {
  ownerKind: DefaultLetterheadGridOwner["kind"];
  hasLayoutLetterhead: boolean;
  canEdit: boolean;
}): DefaultLetterheadSettingsCopy => {
  const isOffice = ownerKind === "office";
  const scope = isOffice
    ? "Documents set to “Default” in this office's projects"
    : "Documents set to “Default” in the organization's projects";
  const unlessOffice = isOffice
    ? ""
    : " (unless their office has its own letterhead)";
  const saved = "Saved from a document's letterhead.";

  let note = saved;
  let afterRemoval = "will have no default letterhead";
  if (hasLayoutLetterhead) {
    note = `${saved} It replaces the layout settings while it is set${canEdit ? "; remove it to use them again." : "."}`;
    afterRemoval = "go back to the layout settings";
  } else if (isOffice) {
    note = `${saved} While it is set, this office's documents use it instead of the organization's letterhead${canEdit ? "; remove it to go back to that." : "."}`;
    afterRemoval = "go back to the organization's letterhead";
  }

  return {
    note,
    removeDescription: `${scope} ${afterRemoval}${unlessOffice}. ${KEEP_OWN_NOTE}`,
  };
};

/** A default grid as the letterhead `LetterheadBand` draws. */
export const defaultGridPreviewLetterhead = (
  grid: PublicGridLetterhead,
): PublicGridDocumentLetterhead => {
  const color = normalizeLetterheadColor(grid.color);
  return {
    layout: "grid",
    grid: { ...grid, color },
    ...gridToLines(grid),
    color,
  };
};
