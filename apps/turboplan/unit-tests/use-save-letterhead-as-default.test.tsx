import React from "react";

import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";

import type { PublicGridLetterhead } from "@wildfires-org/turboplan-workspace/types";

import type * as HookModule from "../hooks/use-save-letterhead-as-default";
import type {
  DefaultLetterheadGridOwner,
  DefaultLetterheadGridResponse,
  ProjectLetterheadTarget,
} from "../lib/default-letterhead-grid";

// "Save as organization letterhead" for a document's copy. The project's
// letterhead target is SWR's fallback data (each test sets it), the API
// client's raw fetch answers what each test sets, and the cache refresh
// after a save is recorded (what it refreshes — the letterhead-target keys
// included — is tested in grid-letterhead-editor-target.test.ts).

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const SAVED_GRID_VERSION = "b81e07c2a95d4f36";
const TARGET_URL = `/api/projects/${PROJECT_ID}/letterhead-target`;
const NOT_SAVABLE_MESSAGE =
  "This letterhead can't be saved as a default yet — open it in the editor, save it, and try again.";

type Refresh = {
  owner: DefaultLetterheadGridOwner;
  saved: DefaultLetterheadGridResponse | undefined;
};

const requests: { url: string; init: RequestInit }[] = [];
const refreshes: Refresh[] = [];
const toasts: { type: string; description: string }[] = [];
let projectTarget: ProjectLetterheadTarget;
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
  },
});
mock.module("../components/toast", {
  namedExports: {
    toast: (props: { type: string; description: string }) => {
      toasts.push(props);
    },
  },
});
mock.module("../hooks/use-document-letterhead", {
  namedExports: {
    // The project resolves no default letterhead today.
    useDocumentLetterhead: () => ({ defaultLetterhead: null }),
  },
});
mock.module("../hooks/use-default-letterhead-grid", {
  namedExports: {
    revalidateDefaultLetterheadGrid: (
      _mutate: unknown,
      owner: DefaultLetterheadGridOwner,
      saved?: DefaultLetterheadGridResponse,
    ) => {
      refreshes.push({ owner, saved });
    },
  },
});
process.env.SERVER_URL = "https://api.example.test";

let useSaveLetterheadAsDefault: typeof HookModule.useSaveLetterheadAsDefault;

before(async () => {
  Object.assign(globalThis, { React });
  ({ useSaveLetterheadAsDefault } = await import(
    "../hooks/use-save-letterhead-as-default"
  ));
});

beforeEach(() => {
  requests.length = 0;
  refreshes.length = 0;
  toasts.length = 0;
  projectTarget = {
    organizationId: ORGANIZATION_ID,
    officeId: OFFICE_ID,
    officeHasOwnDefault: false,
    canEditOrganization: true,
    canEditOffice: false,
  };
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const grid: PublicGridLetterhead = {
  cells: [
    {
      kind: "text",
      x: 0,
      width: 1,
      align: "left",
      lines: [{ text: "Example Agency", bold: true, size: "normal" }],
    },
  ],
  color: null,
};

// The hook's answer for the document, rendered once.
const renderHook = () => {
  let result: ReturnType<typeof useSaveLetterheadAsDefault> | undefined;
  const Probe = () => {
    result = useSaveLetterheadAsDefault({
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      enabled: true,
    });
    return null;
  };
  renderToStaticMarkup(
    <SWRConfig
      value={{
        provider: () => new Map(),
        fallback: { [TARGET_URL]: projectTarget },
      }}
    >
      <Probe />
    </SWRConfig>,
  );
  assert.ok(result);
  return result;
};

describe("useSaveLetterheadAsDefault", () => {
  it("posts the document's copy to the target's from-document endpoint", async () => {
    answer = () => json({ grid, version: SAVED_GRID_VERSION }, 200);
    const { copy, save } = renderHook();

    assert.equal(copy?.actionLabel, "Save as organization letterhead…");
    assert.equal(await save(), true);

    const url = `/api/organizations/${ORGANIZATION_ID}/letterhead-grid/from-document`;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, url);
    assert.equal(requests[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
    });
    assert.deepEqual(toasts, [
      {
        type: "success",
        description: "Saved as the organization's letterhead.",
      },
    ]);
  });

  it("goes to the office when its own default hides the organization's", async () => {
    projectTarget = {
      ...projectTarget,
      officeHasOwnDefault: true,
      canEditOffice: true,
    };
    answer = () => json({ grid, version: SAVED_GRID_VERSION }, 200);

    assert.equal(await renderHook().save(), true);
    assert.equal(
      requests[0]?.url,
      `/api/offices/${OFFICE_ID}/letterhead-grid/from-document`,
    );
  });

  it("refreshes what the new default changes — its settings, the letterhead targets, the documents — once", async () => {
    answer = () => json({ grid, version: SAVED_GRID_VERSION }, 200);

    await renderHook().save();

    assert.deepEqual(refreshes, [
      {
        owner: { kind: "organization", id: ORGANIZATION_ID },
        saved: { grid, version: SAVED_GRID_VERSION },
      },
    ]);
  });

  it("says how to fix a copy the server refuses (404)", async () => {
    answer = () => json({ error: "Document or letterhead not found" }, 404);

    assert.equal(await renderHook().save(), false);
    assert.deepEqual(toasts, [
      { type: "error", description: NOT_SAVABLE_MESSAGE },
    ]);
    assert.deepEqual(refreshes, []);
  });

  it("keeps the server's message for any other refusal", async () => {
    answer = () => json({ error: "Forbidden" }, 403);
    assert.equal(await renderHook().save(), false);

    answer = () => {
      throw new TypeError("Failed to fetch");
    };
    assert.equal(await renderHook().save(), false);

    assert.deepEqual(
      toasts.map(({ description }) => description),
      ["Forbidden", "Failed to save letterhead"],
    );
    assert.deepEqual(refreshes, []);
  });

  it("offers nothing when the user can change neither default", async () => {
    projectTarget = { ...projectTarget, canEditOrganization: false };
    const { copy, save } = renderHook();

    assert.equal(copy, null);
    assert.equal(await save(), false);
    assert.equal(requests.length, 0);
    assert.deepEqual(toasts, []);
  });
});
