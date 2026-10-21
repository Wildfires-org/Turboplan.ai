import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";

import type { PublicGridLetterhead } from "@wildfires-org/turboplan-workspace/types";

import type * as LogoHookModule from "../hooks/use-letterhead-logo";
import type * as LogoFetchModule from "../lib/export/letterhead-logo";

// The logo fetchers run in the browser: the API client's token, `fetch` and
// `createImageBitmap` are stubbed. Each logo's bytes name its index.

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const OTHER_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";

mock.module("@wildfires-org/turboplan-api-client", {
  namedExports: {
    ApiClient: class {
      async getToken() {
        return "token";
      }
    },
  },
});
process.env.SERVER_URL = "https://api.example.test";

let fetchGridLetterheadLogos: typeof LogoFetchModule.fetchGridLetterheadLogos;
let letterheadLogoKey: typeof LogoHookModule.letterheadLogoKey;
let letterheadLogoKeysOf: typeof LogoHookModule.letterheadLogoKeysOf;

before(async () => {
  ({ fetchGridLetterheadLogos } = await import(
    "../lib/export/letterhead-logo"
  ));
  ({ letterheadLogoKey, letterheadLogoKeysOf } = await import(
    "../hooks/use-letterhead-logo"
  ));
});

const originalFetch = globalThis.fetch;
const originalCreateImageBitmap = globalThis.createImageBitmap;
const requestedIndexes: number[] = [];
const failingIndexes = new Set<number>();

beforeEach(() => {
  requestedIndexes.length = 0;
  failingIndexes.clear();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const index = Number(url.searchParams.get("index") ?? 0);
    requestedIndexes.push(index);
    if (failingIndexes.has(index)) {
      return new Response(null, { status: 204 });
    }
    return new Response(`logo-${index}`, {
      headers: { "Content-Type": "image/png" },
    });
  }) as typeof fetch;
  globalThis.createImageBitmap = (async () => ({
    width: 40,
    height: 20,
    close: () => {},
  })) as unknown as typeof createImageBitmap;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.createImageBitmap = originalCreateImageBitmap;
});

const logoCell = (x: number, index: number) => ({
  kind: "logo" as const,
  x,
  width: 0.1,
  height: 0.1,
  index,
});

// Stored right logo first: slots follow `index` (left to right), not the
// cells' array order.
const twoLogos: PublicGridLetterhead = {
  cells: [
    logoCell(0.9, 1),
    {
      kind: "text",
      x: 0.2,
      width: 0.5,
      align: "left",
      lines: [{ text: "Agency", bold: true, size: "normal" }],
    },
    logoCell(0, 0),
  ],
  color: null,
};

const decode = (logo: { data: ArrayBuffer | Uint8Array } | null) =>
  logo ? new TextDecoder().decode(logo.data) : null;

describe("fetchGridLetterheadLogos", () => {
  it("fetches every logo cell, slotted by index", async () => {
    const logos = await fetchGridLetterheadLogos(
      PROJECT_ID,
      DOCUMENT_ID,
      twoLogos,
    );

    assert.deepEqual(logos.map(decode), ["logo-0", "logo-1"]);
    assert.deepEqual([...requestedIndexes].sort(), [0, 1]);
    assert.deepEqual(
      {
        width: logos[0]?.width,
        height: logos[0]?.height,
        type: logos[0]?.type,
      },
      { width: 40, height: 20, type: "png" },
    );
  });

  it("reuses an index-0 logo the caller already has, a null one included", async () => {
    const first = {
      data: new TextEncoder().encode("prefetched").buffer,
      type: "png" as const,
      width: 1,
      height: 1,
    };

    const reused = await fetchGridLetterheadLogos(
      PROJECT_ID,
      DOCUMENT_ID,
      twoLogos,
      first,
    );
    assert.deepEqual(reused.map(decode), ["prefetched", "logo-1"]);
    assert.deepEqual(requestedIndexes, [1]);

    requestedIndexes.length = 0;
    const withoutFirst = await fetchGridLetterheadLogos(
      PROJECT_ID,
      DOCUMENT_ID,
      twoLogos,
      null,
    );
    assert.deepEqual(withoutFirst.map(decode), [null, "logo-1"]);
    assert.deepEqual(requestedIndexes, [1]);
  });

  it("keeps the slot of a logo that does not load", async () => {
    failingIndexes.add(0);

    const logos = await fetchGridLetterheadLogos(
      PROJECT_ID,
      DOCUMENT_ID,
      twoLogos,
    );

    assert.deepEqual(logos.map(decode), [null, "logo-1"]);
  });

  it("fetches nothing for a grid without logo cells", async () => {
    const logos = await fetchGridLetterheadLogos(PROJECT_ID, DOCUMENT_ID, {
      ...twoLogos,
      cells: [twoLogos.cells[1]],
    });

    assert.deepEqual(logos, []);
    assert.deepEqual(requestedIndexes, []);
  });
});

describe("letterheadLogoKeysOf", () => {
  it("matches every index of exactly that project and document", () => {
    const matches = letterheadLogoKeysOf(PROJECT_ID, DOCUMENT_ID);

    assert.equal(matches(letterheadLogoKey(PROJECT_ID, DOCUMENT_ID)), true);
    assert.equal(matches(letterheadLogoKey(PROJECT_ID, DOCUMENT_ID, 1)), true);
    for (const key of [
      letterheadLogoKey(PROJECT_ID),
      letterheadLogoKey(PROJECT_ID, OTHER_ID, 1),
      letterheadLogoKey(OTHER_ID, DOCUMENT_ID),
      ["letterhead", PROJECT_ID, DOCUMENT_ID, 0],
      `letterhead-logo/${PROJECT_ID}/${DOCUMENT_ID}`,
      null,
    ]) {
      assert.equal(matches(key), false, JSON.stringify(key));
    }
  });

  it("matches the project default's keys without a document", () => {
    const matches = letterheadLogoKeysOf(PROJECT_ID);

    assert.equal(matches(letterheadLogoKey(PROJECT_ID, null, 1)), true);
    assert.equal(matches(letterheadLogoKey(PROJECT_ID, DOCUMENT_ID)), false);
  });
});
