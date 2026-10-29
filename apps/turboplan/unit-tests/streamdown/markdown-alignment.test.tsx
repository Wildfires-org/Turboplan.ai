import React from "react";

import assert from "node:assert";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "../../components/markdown";

// The editor builds its ProseMirror doc from this HTML (lib/editor/functions),
// reading a cell's alignment from `style.textAlign` / `align` and a centered
// paragraph from `p.text-center`. If the th/td or p overrides in
// components/markdown.tsx dropped them, an edit would silently strip the
// letterhead's alignment markers or `{center}` prefixes.

const LETTERHEAD = [
  "| **[INSERT: firm name]** | Tagline | 100 Main Street |",
  "| :--- | :---: | ---: |",
  "| | | Eureka, CA 95501 |",
].join("\n");

const cellAlignments = (html: string, tag: "th" | "td"): string[] =>
  // `(?:\s[^>]*)?` so `<th` doesn't also match `<thead>`.
  [...html.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g"))].map(
    ([openTag]) =>
      openTag.match(/text-align:\s*(\w+)/)?.[1] ??
      openTag.match(/align="(\w+)"/)?.[1] ??
      "",
  );

describe("Markdown alignment (Streamdown integration)", () => {
  it("puts each column's alignment on its header and body cells", () => {
    const html = renderToStaticMarkup(
      <Markdown stripNotes={false}>{LETTERHEAD}</Markdown>,
    );
    assert.deepStrictEqual(cellAlignments(html, "th"), [
      "left",
      "center",
      "right",
    ]);
    assert.deepStrictEqual(cellAlignments(html, "td"), [
      "left",
      "center",
      "right",
    ]);
  });

  it("renders {center} lines as centered paragraphs without the marker", () => {
    const html = renderToStaticMarkup(
      <Markdown>{"{center}**Proposal Title**"}</Markdown>,
    );
    assert.match(html, /<p class="text-center">/);
    assert.ok(html.includes("Proposal Title"));
    assert.ok(!html.includes("{center}"), html);
  });

  it("splits an inline {center} marker onto its own paragraph", () => {
    const html = renderToStaticMarkup(
      <Markdown>{"Intro text {center}Centered title"}</Markdown>,
    );
    assert.match(html, /<p>Intro text<\/p>/);
    assert.match(html, /<p class="text-center">Centered title<\/p>/);
  });

  it("still renders {right} lines right-aligned", () => {
    const html = renderToStaticMarkup(
      <Markdown>{"{right}Date: today"}</Markdown>,
    );
    assert.match(html, /<p class="text-right">Date: today<\/p>/);
  });
});
