import React from "react";

import assert from "node:assert";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "../../components/markdown";

// Renders the real chat Markdown component (Streamdown + placeholder
// stripping) so regressions in the strip → GFM parse pipeline show up here,
// not just in the lib/placeholders unit tests.
//
// Lives in unit-tests/streamdown/ because streamdown and @streamdown/code are
// ESM-only (`import` exports condition only): loading them from this CJS-mode
// app requires `node --conditions=import` (the test:streamdown script), and
// that flag breaks tslib interop in other tests, so this directory runs as a
// separate pass.

const NOTE = "verify — taken from reference letter";
const NOTED_PLACEHOLDER = `[INSERT: office street address — suggested: 10811 Stockrest Springs Road || ${NOTE}]`;

const TABLE_WITH_NOTE = [
  "| Agency | Address |",
  "| --- | --- |",
  `| USDA | ${NOTED_PLACEHOLDER} |`,
].join("\n");

const PIPELESS_TABLE_WITH_NOTE = [
  "Agency | Address",
  "--- | ---",
  `USDA | ${NOTED_PLACEHOLDER}`,
].join("\n");

describe("Markdown table note stripping (Streamdown integration)", () => {
  it("renders a noted table as a real table with the note stripped (stripNotes default)", () => {
    const html = renderToStaticMarkup(<Markdown>{TABLE_WITH_NOTE}</Markdown>);
    assert.ok(html.includes("<table"), `no <table> in output: ${html}`);
    assert.ok(html.includes("[INSERT: office street address"));
    assert.ok(!html.includes(NOTE), "reviewer note leaked into chat output");
  });

  it("renders a noted table as a real table even when stripNotes is false", () => {
    const html = renderToStaticMarkup(
      <Markdown stripNotes={false}>{TABLE_WITH_NOTE}</Markdown>,
    );
    assert.ok(html.includes("<table"), `no <table> in output: ${html}`);
    assert.ok(html.includes("[INSERT: office street address"));
    assert.ok(!html.includes(NOTE), "note pipes broke the GFM table parse");
  });

  it("handles GFM rows without a leading pipe", () => {
    const html = renderToStaticMarkup(
      <Markdown stripNotes={false}>{PIPELESS_TABLE_WITH_NOTE}</Markdown>,
    );
    assert.ok(html.includes("<table"), `no <table> in output: ${html}`);
    assert.ok(!html.includes(NOTE), "note survived in a pipe-less table row");
  });

  it("keeps notes outside tables when stripNotes is false", () => {
    const html = renderToStaticMarkup(
      <Markdown stripNotes={false}>
        {`Call ${NOTED_PLACEHOLDER} for details.`}
      </Markdown>,
    );
    assert.ok(html.includes(NOTE), "note was stripped outside a table");
  });

  it("strips notes outside tables when stripNotes is true", () => {
    const html = renderToStaticMarkup(
      <Markdown>{`Call ${NOTED_PLACEHOLDER} for details.`}</Markdown>,
    );
    assert.ok(!html.includes(NOTE));
    assert.ok(html.includes("[INSERT: office street address"));
  });
});
