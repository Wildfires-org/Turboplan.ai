import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import type * as GetContentsModule from "../lib/ai/tools/get-contents";

const STORAGE_URL = "https://files.example.test/uploads/u/letter.pdf";
const WEB_URL = "https://example.gov/letter.pdf";

const exaCalls: string[][] = [];
const remembered: unknown[] = [];

mock.module("@wildfires-org/turboplan-ai", {
  namedExports: { getPrompt: async () => "Read content from URLs." },
});
mock.module("../lib/ai/exa-client", {
  namedExports: {
    exaGetContents: async (urls: string[]) => {
      exaCalls.push(urls);
      return {
        results: urls.map((url) => ({ url, title: "Web", text: "Web text" })),
      };
    },
  },
});

// The real storage host check runs against R2_PUBLIC_URL.
// The turboplan app resolves as CJS, so import after the mocks are registered.
let getContentsModule: typeof GetContentsModule;

before(async () => {
  process.env.R2_PUBLIC_URL = "https://files.example.test";
  resetEnvCache();
  getContentsModule = await import("../lib/ai/tools/get-contents");
});

beforeEach(() => {
  exaCalls.length = 0;
  remembered.length = 0;
});

const runGetContents = async (urls: string[]) => {
  const getContentsTool = await getContentsModule.getContents({
    referenceCache: {
      remember: (results) => {
        remembered.push(...results);
      },
      get: () => undefined,
    },
  });
  return (await getContentsTool.execute?.(
    { urls, maxCharacters: 10_000 },
    { toolCallId: "call-1", messages: [] },
  )) as Record<string, unknown>;
};

describe("getContents", () => {
  it("never sends our storage URLs to Exa and says how to read them", async () => {
    const result = await runGetContents([
      STORAGE_URL,
      "http://FILES.example.test./uploads/u/other.pdf",
      WEB_URL,
    ]);

    assert.deepStrictEqual(exaCalls, [[WEB_URL]]);
    assert.deepStrictEqual(result.skippedUrls, [
      STORAGE_URL,
      "http://FILES.example.test./uploads/u/other.pdf",
    ]);
    assert.match(String(result.note), /readProjectDocuments/);
    assert.deepStrictEqual(
      (result.results as Array<{ url: string }>).map(({ url }) => url),
      [WEB_URL],
    );
  });

  it("does not call Exa when every URL is a storage URL", async () => {
    const result = await runGetContents([STORAGE_URL]);

    assert.deepStrictEqual(exaCalls, []);
    assert.deepStrictEqual(result.results, []);
    assert.deepStrictEqual(result.skippedUrls, [STORAGE_URL]);
    assert.deepStrictEqual(remembered, []);
  });

  it("reads web URLs as before, without a note", async () => {
    const result = await runGetContents([WEB_URL]);

    assert.deepStrictEqual(exaCalls, [[WEB_URL]]);
    assert.ok(!("note" in result));
    assert.strictEqual(remembered.length, 1);
  });
});
