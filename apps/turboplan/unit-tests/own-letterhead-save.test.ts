import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

import type { PublicDocumentLetterhead } from "@wildfires-org/turboplan-workspace/types";

import type * as LetterheadModule from "../lib/export/letterhead";

// Saving the letterhead editor's edit: the API client's raw fetch is stubbed
// with the answer of each test.

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const SAVE_URL =
  "/api/documents/0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e/letterhead/own";
const VERSION = "2026-10-20T10:00:00.123Z";
const SAVED_VERSION = "2026-10-20T10:05:00.456Z";

const requests: { url: string; init: RequestInit }[] = [];
let answer: () => Response | Promise<Response>;

mock.module("@wildfires-org/turboplan-api-client", {
  namedExports: {
    ApiClient: class {
      async getToken() {
        return "token";
      }
      async fetchRaw(url: string, init: RequestInit) {
        requests.push({ url, init });
        return answer();
      }
    },
  },
});
process.env.SERVER_URL = "https://api.example.test";

let saveOwnLetterheadFetcher: typeof LetterheadModule.saveOwnLetterheadFetcher;
let withSavedOwnLetterhead: typeof LetterheadModule.withSavedOwnLetterhead;
let LetterheadSaveError: typeof LetterheadModule.LetterheadSaveError;

before(async () => {
  ({ saveOwnLetterheadFetcher, withSavedOwnLetterhead, LetterheadSaveError } =
    await import("../lib/export/letterhead"));
});

beforeEach(() => {
  requests.length = 0;
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const saved: PublicDocumentLetterhead = {
  layout: "grid",
  grid: {
    cells: [
      { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
      {
        kind: "text",
        x: 0.2,
        width: 0.8,
        align: "left",
        lines: [{ text: "Example Agency", bold: true, size: "normal" }],
      },
    ],
    color: null,
  },
  nameLines: ["Example Agency"],
  contactLines: [],
  color: null,
};

const save = () =>
  saveOwnLetterheadFetcher(SAVE_URL, {
    arg: {
      projectId: PROJECT_ID,
      version: VERSION,
      grid: { cells: [], color: null },
    },
  });

// The error a save is refused with.
const refusal = async () => {
  try {
    await save();
  } catch (error) {
    assert.ok(error instanceof LetterheadSaveError);
    return error;
  }
  assert.fail("the save was not refused");
};

describe("saveOwnLetterheadFetcher", () => {
  it("PUTs the edit with its version and answers the saved copy", async () => {
    answer = () => json({ letterhead: saved, version: SAVED_VERSION }, 200);

    assert.deepEqual(await save(), {
      letterhead: saved,
      version: SAVED_VERSION,
    });
    const [{ url, init }] = requests;
    assert.equal(url, SAVE_URL);
    assert.equal(init.method, "PUT");
    assert.deepEqual(JSON.parse(String(init.body)), {
      projectId: PROJECT_ID,
      version: VERSION,
      grid: { cells: [], color: null },
    });
  });

  it("keeps the status of a conflict (409)", async () => {
    answer = () =>
      json(
        { error: "The letterhead was changed meanwhile — reopen the editor" },
        409,
      );

    const error = await refusal();
    assert.equal(error.status, 409);
    assert.equal(error.field, null);
    assert.equal(
      error.message,
      "The letterhead was changed meanwhile — reopen the editor",
    );
  });

  it("keeps the field of an invalid edit", async () => {
    answer = () =>
      json(
        { error: "Column 1: upload the logo again", field: "cells.0.url" },
        400,
      );

    const error = await refusal();
    assert.equal(error.status, 400);
    assert.equal(error.field, "cells.0.url");
    assert.equal(error.message, "Column 1: upload the logo again");
  });

  it("falls back to a generic message without a JSON answer or any answer", async () => {
    answer = () => new Response("Bad gateway", { status: 502 });
    const failed = await refusal();
    assert.equal(failed.status, 502);
    assert.equal(failed.message, "Failed to save letterhead");

    answer = () => {
      throw new TypeError("Failed to fetch");
    };
    const unreachable = await refusal();
    assert.equal(unreachable.status, null);
    assert.equal(unreachable.message, "Failed to save letterhead");
  });
});

describe("withSavedOwnLetterhead", () => {
  const current = {
    letterhead: { ...saved, nameLines: ["Old Agency"] },
    markdown: null,
    selection: "own" as const,
    defaultLetterhead: null,
    options: [],
    own: { referenceFilename: "blm-letter.pdf", version: VERSION },
  };
  const response = { letterhead: saved, version: SAVED_VERSION };

  it("shows the saved copy at once and keeps its new version", () => {
    assert.deepEqual(withSavedOwnLetterhead(current, response), {
      ...current,
      letterhead: saved,
      own: { referenceFilename: "blm-letter.pdf", version: SAVED_VERSION },
    });
  });

  it("leaves another selected letterhead as it is", () => {
    const other = { ...current, selection: "default" as const };

    assert.deepEqual(
      withSavedOwnLetterhead(other, response).letterhead,
      other.letterhead,
    );
  });
});
