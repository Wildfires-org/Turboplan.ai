import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

import type {
  GridLetterheadEdit,
  GridLetterheadTextCell,
  PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import type * as DefaultGridHooksModule from "../hooks/use-default-letterhead-grid";
import type * as LogoHookModule from "../hooks/use-letterhead-logo";
import type * as LetterheadModule from "../lib/export/letterhead";
import type * as LogoFetchModule from "../lib/export/letterhead-logo";
import type * as TargetModule from "../lib/grid-letterhead-editor-target";

// The grid letterhead editor's two targets — a document's own copy and an
// organization's / office's default — differ in where an edit is saved
// (and with which version) and where the saved logos load from. The API
// client's raw fetch is stubbed with the answer of each test.

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
// A document copy's version is its `updated_at`; a default grid's, the first
// 16 hex chars of the SHA-256 of the stored grid (`^[0-9a-f]{16}$`).
const VERSION = "2026-10-20T10:00:00.123Z";
const SAVED_VERSION = "2026-10-20T10:05:00.456Z";
const GRID_VERSION = "3f2a9c41d07be5a8";
const SAVED_GRID_VERSION = "b81e07c2a95d4f36";

const requests: { url: string; init: RequestInit }[] = [];
let answer: () => Response | Promise<Response>;

mock.module("@wildfires-org/turboplan-api-client", {
  namedExports: {
    ApiClient: class {
      async getToken() {
        return "token";
      }
      async fetchRaw(url: string, init: RequestInit = {}) {
        requests.push({ url, init });
        return answer();
      }
    },
    fetcher: async () => null,
    postFetcher: async () => null,
  },
});
process.env.SERVER_URL = "https://api.example.test";

let target: typeof TargetModule;
let LetterheadSaveError: typeof LetterheadModule.LetterheadSaveError;
let letterheadLogoKey: typeof LogoHookModule.letterheadLogoKey;
let defaultGridHooks: typeof DefaultGridHooksModule;
let fetchDefaultLetterheadGridLogoBlob: typeof LogoFetchModule.fetchDefaultLetterheadGridLogoBlob;

before(async () => {
  target = await import("../lib/grid-letterhead-editor-target");
  ({ LetterheadSaveError } = await import("../lib/export/letterhead"));
  ({ letterheadLogoKey } = await import("../hooks/use-letterhead-logo"));
  defaultGridHooks = await import("../hooks/use-default-letterhead-grid");
  ({ fetchDefaultLetterheadGridLogoBlob } = await import(
    "../lib/export/letterhead-logo"
  ));
});

beforeEach(() => {
  requests.length = 0;
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const organization = { kind: "organization" as const, id: ORGANIZATION_ID };
const office = { kind: "office" as const, id: OFFICE_ID };

const documentTarget = {
  kind: "document" as const,
  projectId: PROJECT_ID,
  documentId: DOCUMENT_ID,
  version: VERSION,
};
const organizationTarget = {
  kind: "default" as const,
  owner: organization,
  version: null,
  marginLogoSrc: null,
};
const officeTarget = {
  kind: "default" as const,
  owner: office,
  version: GRID_VERSION,
  marginLogoSrc: "https://files.example.test/logo.png",
};

const textCell: GridLetterheadTextCell = {
  kind: "text",
  x: 0.2,
  width: 0.8,
  align: "left",
  lines: [{ text: "Example Agency", bold: true, size: "normal" }],
};
const edit: GridLetterheadEdit = {
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    textCell,
  ],
  color: null,
};
const publicGrid: PublicGridLetterhead = {
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    textCell,
  ],
  color: null,
};

// The error a save is refused with.
const refusal = async (save: () => Promise<unknown>) => {
  try {
    await save();
  } catch (error) {
    assert.ok(error instanceof LetterheadSaveError);
    return error;
  }
  assert.fail("the save was not refused");
};

describe("gridEditorSaveUrl", () => {
  it("saves a document's copy on the document, a default on its owner", () => {
    assert.equal(
      target.gridEditorSaveUrl(documentTarget),
      `/api/documents/${DOCUMENT_ID}/letterhead/own`,
    );
    assert.equal(
      target.gridEditorSaveUrl(organizationTarget),
      `/api/organizations/${ORGANIZATION_ID}/letterhead-grid`,
    );
    assert.equal(
      target.gridEditorSaveUrl(officeTarget),
      `/api/offices/${OFFICE_ID}/letterhead-grid`,
    );
  });
});

describe("saveGridLetterheadEdit", () => {
  it("PUTs a document's edit with its project and version", async () => {
    const letterhead = {
      layout: "grid",
      grid: publicGrid,
      nameLines: ["Example Agency"],
      contactLines: [],
      color: null,
    };
    answer = () => json({ letterhead, version: SAVED_VERSION }, 200);

    assert.deepEqual(
      await target.saveGridLetterheadEdit(documentTarget, edit),
      { kind: "document", saved: { letterhead, version: SAVED_VERSION } },
    );
    const [{ url, init }] = requests;
    assert.equal(url, `/api/documents/${DOCUMENT_ID}/letterhead/own`);
    assert.equal(init.method, "PUT");
    assert.deepEqual(JSON.parse(String(init.body)), {
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });
  });

  it("PUTs a default's edit with its version, null while none was set", async () => {
    answer = () => json({ grid: publicGrid, version: SAVED_GRID_VERSION }, 200);

    assert.deepEqual(
      await target.saveGridLetterheadEdit(organizationTarget, edit),
      {
        kind: "default",
        saved: { grid: publicGrid, version: SAVED_GRID_VERSION },
      },
    );
    await target.saveGridLetterheadEdit(officeTarget, edit);

    assert.deepEqual(
      requests.map(({ url, init }) => ({
        url,
        method: init.method,
        body: JSON.parse(String(init.body)),
      })),
      [
        {
          url: `/api/organizations/${ORGANIZATION_ID}/letterhead-grid`,
          method: "PUT",
          body: { grid: edit, version: null },
        },
        {
          url: `/api/offices/${OFFICE_ID}/letterhead-grid`,
          method: "PUT",
          body: { grid: edit, version: GRID_VERSION },
        },
      ],
    );
  });

  it("keeps a default's conflict (409) and refused field as for a document", async () => {
    answer = () =>
      json(
        { error: "The letterhead was changed meanwhile — reopen the editor" },
        409,
      );
    const conflict = await refusal(() =>
      target.saveGridLetterheadEdit(officeTarget, edit),
    );
    assert.equal(conflict.status, 409);
    assert.equal(
      conflict.message,
      "The letterhead was changed meanwhile — reopen the editor",
    );

    answer = () =>
      json(
        { error: "Column 1: upload the logo again", field: "cells.0.url" },
        400,
      );
    const invalid = await refusal(() =>
      target.saveGridLetterheadEdit(organizationTarget, edit),
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.field, "cells.0.url");
  });
});

describe("gridEditorLogoKey", () => {
  it("loads a document's logos through its letterhead-logo proxy (the preview's cache)", () => {
    assert.deepEqual(
      target.gridEditorLogoKey(documentTarget, 0, 2),
      letterheadLogoKey(PROJECT_ID, DOCUMENT_ID, 0),
    );
    assert.deepEqual(
      target.gridEditorLogoKey(documentTarget, 1, 2),
      letterheadLogoKey(PROJECT_ID, DOCUMENT_ID, 1),
    );
    assert.equal(target.gridEditorLogoKey(documentTarget, 1, 1), null);
  });

  it("always loads a document's index 0: the margin logo of a grid without logo cells", () => {
    assert.deepEqual(
      target.gridEditorLogoKey(documentTarget, 0, 0),
      letterheadLogoKey(PROJECT_ID, DOCUMENT_ID, 0),
    );
  });

  it("loads a default's logos through its owner's settings proxy, by the editor's version, only those it has", () => {
    assert.deepEqual(
      target.gridEditorLogoKey(organizationTarget, 0, 1),
      defaultGridHooks.defaultLetterheadGridLogoKey(organization, null, 0),
    );
    // The settings preview's key for the same grid: the editor reuses its
    // cached logos.
    assert.deepEqual(target.gridEditorLogoKey(officeTarget, 1, 2), [
      "default-letterhead-grid-logo",
      "office",
      OFFICE_ID,
      GRID_VERSION,
      1,
    ]);
    assert.equal(target.gridEditorLogoKey(organizationTarget, 0, 0), null);
    assert.equal(target.gridEditorLogoKey(officeTarget, 1, 1), null);
  });
});

describe("gridEditorDescription", () => {
  it("says what a save changes", () => {
    assert.equal(
      target.gridEditorDescription(documentTarget),
      "Changes apply to this document only.",
    );
    assert.match(
      target.gridEditorDescription(organizationTarget),
      /organization's projects, unless their office has its own/,
    );
    assert.match(
      target.gridEditorDescription(officeTarget),
      /this office's projects/,
    );
  });
});

describe("fetchDefaultLetterheadGridLogoBlob", () => {
  it("fetches a logo by index through the owner's settings proxy", async () => {
    answer = () =>
      new Response("logo-1", { headers: { "Content-Type": "image/png" } });

    const logo = await fetchDefaultLetterheadGridLogoBlob(office, 1);

    assert.equal(logo?.type, "png");
    assert.equal(await logo?.blob.text(), "logo-1");
    assert.equal(
      requests[0]?.url,
      `/api/offices/${OFFICE_ID}/letterhead-grid/logo?index=1`,
    );
  });

  it("answers null for no logo, an unsupported type or a failure", async () => {
    answer = () => new Response(null, { status: 204 });
    assert.equal(
      await fetchDefaultLetterheadGridLogoBlob(organization, 0),
      null,
    );

    answer = () =>
      new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } });
    assert.equal(
      await fetchDefaultLetterheadGridLogoBlob(organization, 0),
      null,
    );

    answer = () => {
      throw new TypeError("Failed to fetch");
    };
    assert.equal(
      await fetchDefaultLetterheadGridLogoBlob(organization, 0),
      null,
    );
  });
});

describe("defaultLetterheadGridLogoKey", () => {
  it("keys a logo by its owner, the grid's version and its index", () => {
    const key = defaultGridHooks.defaultLetterheadGridLogoKey(
      office,
      GRID_VERSION,
      1,
    );

    assert.deepEqual(key, [
      "default-letterhead-grid-logo",
      "office",
      OFFICE_ID,
      GRID_VERSION,
      1,
    ]);
    // Another version of the same grid is another key: a logo cached for
    // the older one is never shown for it.
    assert.notDeepEqual(
      defaultGridHooks.defaultLetterheadGridLogoKey(
        office,
        SAVED_GRID_VERSION,
        1,
      ),
      key,
    );
  });

  it("fetches the logo by owner and index alone", async () => {
    answer = () =>
      new Response("logo-1", { headers: { "Content-Type": "image/png" } });
    const originalFileReader = globalThis.FileReader;
    // Node has no FileReader; the data URL itself is not under test.
    globalThis.FileReader = class {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = "data:image/png;base64,bG9nby0x";
        this.onload?.();
      }
    } as unknown as typeof FileReader;
    try {
      assert.equal(
        await defaultGridHooks.fetchDefaultLetterheadGridLogoDataUrl(
          defaultGridHooks.defaultLetterheadGridLogoKey(
            office,
            GRID_VERSION,
            1,
          ),
        ),
        "data:image/png;base64,bG9nby0x",
      );
    } finally {
      globalThis.FileReader = originalFileReader;
    }
    assert.equal(
      requests[0]?.url,
      `/api/offices/${OFFICE_ID}/letterhead-grid/logo?index=1`,
    );
  });
});

describe("revalidateDefaultLetterheadGrid", () => {
  // A stand-in for SWR's mutate: records each call with the keys of a
  // filter that match these.
  const KEYS: unknown[] = [
    `/api/organizations/${ORGANIZATION_ID}/letterhead-grid`,
    `/api/projects/${PROJECT_ID}/letterhead-target`,
    [
      "default-letterhead-grid-logo",
      "organization",
      ORGANIZATION_ID,
      GRID_VERSION,
      0,
    ],
    ["document-letterhead", PROJECT_ID, DOCUMENT_ID],
    ["letterhead-logo", PROJECT_ID, DOCUMENT_ID, 1],
  ];
  const recordingMutate = () => {
    const calls: { keys: unknown[]; data: unknown; options: unknown }[] = [];
    const mutate = (async (key: unknown, data?: unknown, options?: unknown) => {
      const keys =
        typeof key === "function" ? KEYS.filter((k) => key(k)) : [key];
      calls.push({ keys, data, options });
    }) as unknown as Parameters<
      typeof DefaultGridHooksModule.revalidateDefaultLetterheadGrid
    >[0];
    return { calls, mutate };
  };

  it("seeds the owner's settings and revalidates the project targets and documents in place", () => {
    const { calls, mutate } = recordingMutate();
    const saved = { grid: publicGrid, version: SAVED_GRID_VERSION };

    defaultGridHooks.revalidateDefaultLetterheadGrid(
      mutate,
      organization,
      saved,
    );

    // The owner's logos are left alone: the new version's keys load anew.
    assert.deepEqual(calls, [
      {
        keys: [`/api/organizations/${ORGANIZATION_ID}/letterhead-grid`],
        data: saved,
        options: { revalidate: false },
      },
      {
        keys: [`/api/projects/${PROJECT_ID}/letterhead-target`],
        data: undefined,
        options: undefined,
      },
      {
        keys: [["letterhead-logo", PROJECT_ID, DOCUMENT_ID, 1]],
        data: undefined,
        options: undefined,
      },
      {
        keys: [["document-letterhead", PROJECT_ID, DOCUMENT_ID]],
        data: undefined,
        options: undefined,
      },
    ]);
  });

  it("revalidates the settings without an answer at hand", () => {
    const { calls, mutate } = recordingMutate();

    defaultGridHooks.revalidateDefaultLetterheadGrid(mutate, organization);

    assert.deepEqual(calls[0], {
      keys: [`/api/organizations/${ORGANIZATION_ID}/letterhead-grid`],
      data: undefined,
      options: undefined,
    });
  });
});
