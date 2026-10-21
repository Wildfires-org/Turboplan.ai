import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicGridLetterhead } from "@wildfires-org/turboplan-workspace/types";

import {
  defaultGridPreviewLetterhead,
  defaultLetterheadGridUrl,
  defaultLetterheadSettingsCopy,
  defaultLetterheadSettingsView,
  isProjectLetterheadTargetKey,
  letterheadSaveTarget,
  type ProjectLetterheadTarget,
  projectLetterheadTargetUrl,
  saveAsDefaultLetterheadCopy,
} from "../lib/default-letterhead-grid";

const ORGANIZATION_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const OFFICE_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
// A default grid's version: the first 16 hex chars of its SHA-256.
const VERSION = "3f2a9c41d07be5a8";

const target = (
  overrides: Partial<ProjectLetterheadTarget> = {},
): ProjectLetterheadTarget => ({
  organizationId: ORGANIZATION_ID,
  officeId: OFFICE_ID,
  officeHasOwnDefault: false,
  canEditOrganization: false,
  canEditOffice: false,
  ...overrides,
});

const organization = { kind: "organization" as const, id: ORGANIZATION_ID };
const office = { kind: "office" as const, id: OFFICE_ID };

const grid: PublicGridLetterhead = {
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    {
      kind: "text",
      x: 0.2,
      width: 0.8,
      align: "left",
      lines: [
        { text: "Example Agency", bold: true, size: "large" },
        { text: "1 Main Street", bold: false, size: "normal" },
      ],
    },
  ],
  color: "#1F5F3A",
};

describe("letterheadSaveTarget", () => {
  it("offers the office when its own default would hide the organization's", () => {
    assert.deepEqual(
      letterheadSaveTarget(
        target({
          officeHasOwnDefault: true,
          canEditOffice: true,
          canEditOrganization: true,
        }),
        true,
      ),
      { owner: office, hasExistingDefault: true, isHiddenByOffice: false },
    );
  });

  it("offers the organization when nothing hides it, replacing the project's default when there is one", () => {
    const editable = target({ canEditOrganization: true, canEditOffice: true });

    assert.deepEqual(letterheadSaveTarget(editable, true), {
      owner: organization,
      hasExistingDefault: true,
      isHiddenByOffice: false,
    });
    assert.deepEqual(letterheadSaveTarget(editable, false), {
      owner: organization,
      hasExistingDefault: false,
      isHiddenByOffice: false,
    });
  });

  it("falls back to the organization when the office's default is not the user's to change", () => {
    assert.deepEqual(
      letterheadSaveTarget(
        target({ officeHasOwnDefault: true, canEditOrganization: true }),
        true,
      ),
      // The project's default is the office's: whether the organization has
      // one is not known.
      { owner: organization, hasExistingDefault: null, isHiddenByOffice: true },
    );
  });

  it("offers the office as a default of its own to a user who can change only the office", () => {
    assert.deepEqual(
      letterheadSaveTarget(target({ canEditOffice: true }), true),
      {
        owner: office,
        hasExistingDefault: false,
        isHiddenByOffice: false,
      },
    );
  });

  it("hides the action when the user can change neither", () => {
    assert.equal(letterheadSaveTarget(target(), true), null);
    assert.equal(
      letterheadSaveTarget(target({ officeHasOwnDefault: true }), true),
      null,
    );
  });
});

describe("saveAsDefaultLetterheadCopy", () => {
  it("asks before replacing the organization's letterhead, for every document on the default", () => {
    assert.deepEqual(
      saveAsDefaultLetterheadCopy({
        owner: organization,
        hasExistingDefault: true,
        isHiddenByOffice: false,
      }),
      {
        actionLabel: "Save as organization letterhead…",
        title: "Replace the organization's letterhead?",
        description:
          "Documents set to “Default” in the organization's projects, existing and new, will use this letterhead instead of the organization's current letterhead (unless their office has its own letterhead). Documents with their own letterhead or a chosen one keep it.",
        confirmLabel: "Replace",
        successMessage: "Saved as the organization's letterhead.",
      },
    );
  });

  it("names the office when that is the target", () => {
    const copy = saveAsDefaultLetterheadCopy({
      owner: office,
      hasExistingDefault: true,
      isHiddenByOffice: false,
    });

    assert.equal(copy.actionLabel, "Save as office letterhead…");
    assert.equal(copy.title, "Replace the office's letterhead?");
    assert.equal(
      copy.description,
      "Documents set to “Default” in this office's projects, existing and new, will use this letterhead instead of the office's current letterhead. Documents with their own letterhead or a chosen one keep it.",
    );
    assert.equal(copy.successMessage, "Saved as the office's letterhead.");
  });

  it("says an office without a default of its own stops using the organization's", () => {
    const copy = saveAsDefaultLetterheadCopy({
      owner: office,
      hasExistingDefault: false,
      isHiddenByOffice: false,
    });

    assert.equal(copy.title, "Use this as the office's letterhead?");
    assert.equal(copy.confirmLabel, "Save");
    assert.equal(
      copy.description,
      "Documents set to “Default” in this office's projects, existing and new, will use this letterhead instead of the organization's letterhead. Documents with their own letterhead or a chosen one keep it.",
    );
  });

  it("does not claim to replace a letterhead that is not there", () => {
    const copy = saveAsDefaultLetterheadCopy({
      owner: organization,
      hasExistingDefault: false,
      isHiddenByOffice: false,
    });

    assert.equal(copy.title, "Use this as the organization's letterhead?");
    assert.equal(copy.confirmLabel, "Save");
    assert.doesNotMatch(copy.description, /instead of|replaces/);
    assert.match(
      copy.description,
      /\(unless their office has its own letterhead\)/,
    );
  });

  it("says when the office's letterhead keeps this project's documents", () => {
    const copy = saveAsDefaultLetterheadCopy({
      owner: organization,
      hasExistingDefault: null,
      isHiddenByOffice: true,
    });

    assert.equal(copy.title, "Use this as the organization's letterhead?");
    assert.match(
      copy.description,
      /replaces the organization's current letterhead, if it has one/,
    );
    assert.match(copy.description, /documents here keep using the office's/);
  });
});

describe("defaultLetterheadSettingsView", () => {
  it("shows a placeholder until the grid first answers, not the layout settings", () => {
    assert.deepEqual(defaultLetterheadSettingsView({}, true), {
      kind: "loading",
    });
  });

  it("keeps the layout settings on failure and without a grid", () => {
    assert.deepEqual(
      defaultLetterheadSettingsView({ error: new Error("Failed") }, true),
      { kind: "legacy" },
    );
    assert.deepEqual(
      defaultLetterheadSettingsView(
        { data: { grid: null, version: null } },
        true,
      ),
      { kind: "legacy" },
    );
  });

  it("shows a set grid with its version, editable only with UPDATE", () => {
    const data = { grid, version: VERSION };

    assert.deepEqual(defaultLetterheadSettingsView({ data }, true), {
      kind: "grid",
      grid,
      version: VERSION,
      canEdit: true,
    });
    assert.deepEqual(defaultLetterheadSettingsView({ data }, false), {
      kind: "grid",
      grid,
      version: VERSION,
      canEdit: false,
    });
    // A revalidation that fails keeps the grid it had.
    assert.equal(
      defaultLetterheadSettingsView({ data, error: new Error("Failed") }, true)
        .kind,
      "grid",
    );
  });

  it("treats an answer without a version as version null", () => {
    const view = defaultLetterheadSettingsView(
      {
        data: { grid } as {
          grid: PublicGridLetterhead;
          version: string | null;
        },
      },
      true,
    );

    assert.equal(view.kind === "grid" ? view.version : "legacy", null);
  });
});

describe("defaultLetterheadSettingsCopy", () => {
  const KEEP = "Documents with their own letterhead or a chosen one keep it.";

  it("brings an organization's documents back to its layout settings", () => {
    assert.deepEqual(
      defaultLetterheadSettingsCopy({
        ownerKind: "organization",
        hasLayoutLetterhead: true,
        canEdit: true,
      }),
      {
        note: "Saved from a document's letterhead. It replaces the layout settings while it is set; remove it to use them again.",
        removeDescription: `Documents set to “Default” in the organization's projects go back to the layout settings (unless their office has its own letterhead). ${KEEP}`,
      },
    );
  });

  it("leaves an organization without layout settings with no default letterhead", () => {
    const copy = defaultLetterheadSettingsCopy({
      ownerKind: "organization",
      hasLayoutLetterhead: false,
      canEdit: true,
    });

    assert.equal(copy.note, "Saved from a document's letterhead.");
    assert.equal(
      copy.removeDescription,
      `Documents set to “Default” in the organization's projects will have no default letterhead (unless their office has its own letterhead). ${KEEP}`,
    );
  });

  it("brings an office's documents back to its layout settings, else to the organization's letterhead", () => {
    assert.equal(
      defaultLetterheadSettingsCopy({
        ownerKind: "office",
        hasLayoutLetterhead: true,
        canEdit: true,
      }).removeDescription,
      `Documents set to “Default” in this office's projects go back to the layout settings. ${KEEP}`,
    );

    assert.deepEqual(
      defaultLetterheadSettingsCopy({
        ownerKind: "office",
        hasLayoutLetterhead: false,
        canEdit: true,
      }),
      {
        note: "Saved from a document's letterhead. While it is set, this office's documents use it instead of the organization's letterhead; remove it to go back to that.",
        removeDescription: `Documents set to “Default” in this office's projects go back to the organization's letterhead. ${KEEP}`,
      },
    );
  });

  it("does not ask a user who cannot remove it to remove it", () => {
    for (const ownerKind of ["organization", "office"] as const) {
      for (const hasLayoutLetterhead of [true, false]) {
        const { note } = defaultLetterheadSettingsCopy({
          ownerKind,
          hasLayoutLetterhead,
          canEdit: false,
        });
        assert.doesNotMatch(note, /remove/i);
        assert.match(note, /\.$/);
      }
    }
  });
});

describe("default letterhead grid endpoints and preview", () => {
  it("builds the organization, office and project endpoints", () => {
    assert.equal(
      defaultLetterheadGridUrl(organization),
      `/api/organizations/${ORGANIZATION_ID}/letterhead-grid`,
    );
    assert.equal(
      defaultLetterheadGridUrl(office),
      `/api/offices/${OFFICE_ID}/letterhead-grid`,
    );
    assert.equal(
      projectLetterheadTargetUrl(ORGANIZATION_ID),
      `/api/projects/${ORGANIZATION_ID}/letterhead-target`,
    );
  });

  it("matches every project's letterhead-target key, and nothing else", () => {
    assert.equal(
      isProjectLetterheadTargetKey(projectLetterheadTargetUrl(OFFICE_ID)),
      true,
    );
    for (const key of [
      `/api/projects/${OFFICE_ID}/letterhead-target/x`,
      `/api/projects/${OFFICE_ID}`,
      defaultLetterheadGridUrl(office),
      ["document-letterhead", OFFICE_ID, null],
      null,
    ]) {
      assert.equal(isProjectLetterheadTargetKey(key), false);
    }
  });

  it("previews the grid with its derived lines and normalised colour", () => {
    assert.deepEqual(defaultGridPreviewLetterhead(grid), {
      layout: "grid",
      grid: { ...grid, color: "#1f5f3a" },
      nameLines: ["Example Agency"],
      contactLines: ["1 Main Street"],
      color: "#1f5f3a",
    });
  });
});
