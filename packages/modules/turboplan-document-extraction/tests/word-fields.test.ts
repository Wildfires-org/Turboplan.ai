import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DocumentReadError } from "../src/errors";
import {
  assertCleanable,
  installFieldCodeGuard,
  MAX_CHARACTERS_TO_CLEAN,
  MAX_OPEN_FIELDS,
  stripFieldCodes,
} from "../src/word-fields";

const require = createRequire(import.meta.url);
const { clean } = require("word-extractor/lib/filters.js") as {
  clean: (text: string) => string;
};
const WordOleExtractor = require("word-extractor/lib/word-ole-extractor.js");

const BEGIN = "\x13";
const SEPARATOR = "\x14";
const END = "\x15";

// Without the guard each of these takes seconds in `clean()` (quadratic); a
// million characters would take minutes. With it they take milliseconds.
const PATHOLOGICAL_LENGTH = 100_000;
const FAST_ENOUGH_MS = 1_000;

/** Body text the library's own `buildDocument()` produces for `text`. */
const buildBody = (text: string): string => {
  const extractor = new WordOleExtractor();
  extractor._pieces = [
    { startCp: 0, endCp: text.length, length: text.length, text },
  ];
  extractor._boundaries = { ccpText: text.length };
  return extractor.buildDocument().getBody();
};

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const FLOOD_FIXTURE = fileURLToPath(
  new URL("./fixtures/field-flood.ts", import.meta.url),
);

/** Run the flood fixture in its own process; see the fixture for why. */
const runFlood = (shape: string) => {
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", FLOOD_FIXTURE, shape],
    { cwd: PACKAGE_DIR, encoding: "utf8", timeout: 120_000 },
  );
  const lastLine = child.stdout.trim().split("\n").pop() ?? "";
  return {
    status: child.status,
    signal: child.signal,
    stderr: child.stderr,
    result: lastLine ? JSON.parse(lastLine) : null,
  };
};

const timed = <T>(run: () => T): { value: T; elapsedMs: number } => {
  const startedAt = performance.now();
  const value = run();
  return { value, elapsedMs: performance.now() - startedAt };
};

describe("stripFieldCodes", () => {
  it("leaves text without fields untouched", () => {
    assert.deepStrictEqual(stripFieldCodes(["plain", " text"]), [
      "plain",
      " text",
    ]);
  });

  it("matches the library's field removal for well-formed fields", () => {
    for (const text of [
      `See ${BEGIN} HYPERLINK "https://example.com" ${SEPARATOR}the site${END}.`,
      `Page ${BEGIN} PAGE ${END}of 3`,
      // Field nested in another field's result, and in its instruction
      `${BEGIN} TOC ${SEPARATOR}Intro ${BEGIN} PAGEREF a ${SEPARATOR}1${END}${END}`,
      `${BEGIN} IF ${BEGIN} MERGEFIELD x ${SEPARATOR}y${END} = "y" ${SEPARATOR}yes${END} done`,
    ]) {
      const [stripped] = stripFieldCodes([text]);
      assert.strictEqual(stripped.length, text.length);
      assert.strictEqual(clean(stripped), clean(text), JSON.stringify(text));
    }
  });

  it("resolves fields that span segments and keeps each segment's length", () => {
    const segments = [`a${BEGIN} HYPER`, `LINK x ${SEPARATOR}li`, `nk${END}b`];
    const stripped = stripFieldCodes(segments);

    assert.deepStrictEqual(
      stripped.map((segment) => segment.length),
      segments.map((segment) => segment.length),
    );
    assert.strictEqual(clean(stripped.join("")), "alinkb");
  });

  it("drops an unmatched start and leaves stray markers as the library does", () => {
    const [stripped] = stripFieldCodes([
      `kept${END} text${SEPARATOR} and${BEGIN} more`,
    ]);
    assert.strictEqual(
      clean(stripped),
      clean(`kept${END} text${SEPARATOR} and more`),
    );
  });

  it("returns a segment with only stray markers unchanged", () => {
    const segment = `a${END}b${SEPARATOR}c`;
    assert.strictEqual(stripFieldCodes([segment])[0], segment);
  });

  it("keeps characters outside the Basic Multilingual Plane intact", () => {
    const text = `\u{1F600}${BEGIN}x${END}\ud800`;
    const [stripped] = stripFieldCodes([text]);
    assert.strictEqual(stripped.length, text.length);
    assert.strictEqual(clean(stripped), "\u{1F600}\ud800");
  });

  it("rejects absurd nesting instead of growing without bound", () => {
    assert.throws(
      () => stripFieldCodes([BEGIN.repeat(MAX_OPEN_FIELDS + 1)]),
      DocumentReadError,
    );
  });
});

describe("assertCleanable", () => {
  it("accepts text up to the limit, tabs not counted", () => {
    assert.doesNotThrow(() =>
      assertCleanable(["\r".repeat(MAX_CHARACTERS_TO_CLEAN), "\t\t\t"]),
    );
  });

  it("rejects text past the limit, counted across segments", () => {
    assert.throws(
      () =>
        assertCleanable([
          "\x00".repeat(MAX_CHARACTERS_TO_CLEAN / 2),
          "\u2019".repeat(MAX_CHARACTERS_TO_CLEAN / 2 + 1),
        ]),
      DocumentReadError,
    );
  });
});

describe("installFieldCodeGuard", () => {
  installFieldCodeGuard();

  for (const [shape, text, expectedBody] of [
    [
      "an unmatched field start",
      `${BEGIN}${"a".repeat(PATHOLOGICAL_LENGTH)}`,
      "a".repeat(PATHOLOGICAL_LENGTH),
    ],
    [
      "balanced nesting after a long run",
      `${BEGIN}${"a".repeat(PATHOLOGICAL_LENGTH)}${BEGIN}x${END}${SEPARATOR}result${END}`,
      "result",
    ],
  ] as const) {
    it(`keeps word-extractor linear for ${shape}`, () => {
      const { value, elapsedMs } = timed(() => buildBody(text));

      assert.strictEqual(value, expectedBody);
      assert.ok(
        elapsedMs < FAST_ENOUGH_MS,
        `buildDocument took ${Math.round(elapsedMs)}ms`,
      );
    });
  }

  it("wraps buildDocument once, even from a second copy of the module", async () => {
    const guarded = WordOleExtractor.prototype.buildDocument;
    installFieldCodeGuard();
    // A query string makes the loader evaluate a fresh module instance, as a
    // second bundled copy would be.
    const secondCopy = await import("../src/word-fields.ts?second-copy");
    secondCopy.installFieldCodeGuard();

    assert.strictEqual(WordOleExtractor.prototype.buildDocument, guarded);
    assert.strictEqual(buildBody(`${BEGIN}a${SEPARATOR}b${END}`), "b");
  });

  for (const [shape, expected] of [
    ["stray-ends", "done"],
    ["fields", "rejected"],
    ["paragraphs", "rejected"],
  ] as const) {
    it(`survives a ${shape} flood under the research agent's worker limits`, () => {
      const { status, signal, stderr, result } = runFlood(shape);

      // A fatal heap abort in the worker takes the whole process down.
      assert.strictEqual(signal, null, stderr);
      assert.strictEqual(status, 0, stderr);
      assert.strictEqual(result?.outcome, expected, JSON.stringify(result));
    });
  }
});
