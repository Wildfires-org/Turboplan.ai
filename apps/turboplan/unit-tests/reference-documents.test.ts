import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createReferenceCache,
  type FetchReferenceContents,
  formatReferenceDocuments,
  MAX_REFERENCE_CHARS,
  normalizeReferenceUrl,
  resolveReferenceDocuments,
} from "../lib/ai/reference-documents.js";

const recordingFetch = (
  results: Array<{ url: string; title?: string; text?: string }>,
) => {
  const calls: Array<{ urls: string[]; maxCharacters: number }> = [];
  const fetchContents: FetchReferenceContents = async (urls, maxCharacters) => {
    calls.push({ urls, maxCharacters });
    return { results };
  };
  return { calls, fetchContents };
};

describe("normalizeReferenceUrl", () => {
  it("ignores fragments, trailing slashes and host case", () => {
    assert.equal(
      normalizeReferenceUrl("https://Example.gov/docs/letter.pdf/#page=2"),
      "https://example.gov/docs/letter.pdf",
    );
    assert.equal(
      normalizeReferenceUrl("https://example.gov/a?id=1"),
      "https://example.gov/a?id=1",
    );
  });

  it("rejects anything that is not an http(s) URL", () => {
    assert.equal(normalizeReferenceUrl("not a url"), null);
    assert.equal(normalizeReferenceUrl("javascript:alert(1)"), null);
  });
});

describe("resolveReferenceDocuments", () => {
  it("uses text read earlier by getContents without fetching again", async () => {
    const cache = createReferenceCache();
    cache.remember([
      { url: "https://example.gov/letter.pdf", title: "Letter", text: "Body" },
    ]);
    const { calls, fetchContents } = recordingFetch([]);

    const documents = await resolveReferenceDocuments({
      urls: ["https://example.gov/letter.pdf/"],
      cache,
      fetchContents,
    });

    assert.deepEqual(documents, [
      { url: "https://example.gov/letter.pdf", title: "Letter", text: "Body" },
    ]);
    assert.equal(calls.length, 0);
  });

  it("does not cache highlights-only reads, and fetches what is missing", async () => {
    const cache = createReferenceCache();
    cache.remember([{ url: "https://example.gov/letter.pdf" }]);
    const { calls, fetchContents } = recordingFetch([
      { url: "https://example.gov/letter.pdf", text: "Fetched body" },
    ]);

    const documents = await resolveReferenceDocuments({
      urls: ["https://example.gov/letter.pdf"],
      cache,
      fetchContents,
    });

    assert.deepEqual(calls, [
      {
        urls: ["https://example.gov/letter.pdf"],
        maxCharacters: MAX_REFERENCE_CHARS,
      },
    ]);
    assert.equal(documents[0]?.text, "Fetched body");
  });

  it("drops invalid and duplicate URLs and keeps at most two", async () => {
    const cache = createReferenceCache();
    const { calls, fetchContents } = recordingFetch([]);

    await resolveReferenceDocuments({
      urls: [
        "nope",
        "https://a.gov/1",
        "https://a.gov/1#top",
        "https://a.gov/2",
        "https://a.gov/3",
      ],
      cache,
      fetchContents,
    });

    assert.deepEqual(calls[0]?.urls, ["https://a.gov/1", "https://a.gov/2"]);
  });

  it("caps long references and marks the cut", async () => {
    const cache = createReferenceCache();
    cache.remember([
      { url: "https://a.gov/long", text: "x".repeat(MAX_REFERENCE_CHARS + 50) },
    ]);
    const { fetchContents } = recordingFetch([]);

    const [document] = await resolveReferenceDocuments({
      urls: ["https://a.gov/long"],
      cache,
      fetchContents,
    });

    assert.ok(document);
    assert.ok(document.text.startsWith("x".repeat(MAX_REFERENCE_CHARS)));
    assert.ok(document.text.endsWith("[Reference text truncated here.]"));
  });

  it("never throws when the fetch fails", async () => {
    const documents = await resolveReferenceDocuments({
      urls: ["https://a.gov/1"],
      cache: createReferenceCache(),
      fetchContents: async () => {
        throw new Error("network down");
      },
    });

    assert.deepEqual(documents, []);
  });
});

describe("formatReferenceDocuments", () => {
  it("frames each reference as structure and style only", () => {
    const section = formatReferenceDocuments([
      { url: "https://a.gov/1", title: "Scoping Letter", text: "Body" },
    ]);

    assert.ok(section.startsWith("## REFERENCE DOCUMENT ("));
    assert.match(section, /structure, style and length ONLY/);
    assert.match(section, /Source: Scoping Letter — https:\/\/a\.gov\/1/);
    assert.ok(section.endsWith("Body"));
  });

  it("is empty without references", () => {
    assert.equal(formatReferenceDocuments([]), "");
  });
});
