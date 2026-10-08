import assert from "node:assert";
import { before, describe, it } from "node:test";
import { parseHTML } from "linkedom";

import {
  blockClassFor,
  CLOSING_LINE_CLASS,
  SECTION_HEADING_CLASS,
} from "../../lib/editor/block-styles";
import { documentSchema as schema } from "../../lib/editor/config";
import { buildContentFromDocument } from "../../lib/editor/markdown-serializer";
import { buildDocumentFromContent } from "../../lib/editor/parse-document";

// The editor parses the stored markdown into ProseMirror and serializes the
// whole document back on every edit. Anything that doesn't survive that round
// trip is silently rewritten in storage (and shows up in the version diff),
// and the exports, the AI update prompt and placeholder filling all read the
// stored markdown.

const LETTER = [
  "| **United States Department of Agriculture** | Forest Service | Descanso Ranger District |",
  "|:---|:---:|---:|",
  "| | | 3348 Alpine Boulevard |",
  "",
  "{right}**File Code:** [INSERT: file code — suggested: 1950 || verify the file code with the NEPA coordinator]",
  "{right}**Date:** October 8, 2026",
  "",
  "Dear Interested Party:",
  "",
  "The Forest Service is initiating the **Jackson Creek Fuels Reduction** project. Details are online at https://www.fs.usda.gov/project/?project=[INSERT: PALS number].",
  "",
  "**Purpose and Need**",
  "",
  "Decades of fire exclusion have resulted in dense, decadent chamise chaparral (~1,250 acres).",
  "",
  "## How to Comment",
  "Comments may be sent to:",
  "",
  "[INSERT: project contact name and title || verify the assigned project contact]",
  "Descanso Ranger District",
  "3348 Alpine Boulevard",
  "Alpine, CA 91901",
  "",
  "Please include:",
  "- your name and address;",
  "- the project name.",
  "",
  "Sincerely,",
  "",
  "MARIA DELGADO",
  "District Ranger",
].join("\n");

const roundTrip = (markdown: string) =>
  buildContentFromDocument(buildDocumentFromContent(markdown));

const blockNames = (markdown: string) => {
  const names: string[] = [];
  buildDocumentFromContent(markdown).forEach((node) => {
    names.push(node.type.name);
  });
  return names;
};

describe("editor markdown round trip", () => {
  before(() => {
    const { document } = parseHTML("<!doctype html><html><body></body></html>");
    Object.assign(globalThis, { document });
  });

  it("writes a real-looking letter back unchanged", () => {
    assert.strictEqual(roundTrip(LETTER), LETTER);
  });

  it("parses the letter into the blocks the preview shows", () => {
    assert.deepStrictEqual(blockNames(LETTER), [
      "table",
      "right_aligned",
      "right_aligned",
      "paragraph", // Dear Interested Party:
      "paragraph",
      "paragraph", // **Purpose and Need**
      "paragraph",
      "heading",
      "paragraph", // Comments may be sent to:
      "paragraph", // the address block, one paragraph with line breaks
      "paragraph",
      "bullet_list",
      "paragraph", // Sincerely,
      "paragraph", // the signature
    ]);
  });

  it("keeps single newlines as line breaks inside one paragraph", () => {
    const doc = buildDocumentFromContent("MARIA DELGADO\nDistrict Ranger");
    assert.strictEqual(doc.childCount, 1);
    const signature = doc.child(0);
    assert.strictEqual(signature.type.name, "paragraph");
    assert.strictEqual(signature.child(1).type.name, "hard_break");
    assert.strictEqual(signature.textContent, "MARIA DELGADODistrict Ranger");
  });

  it("gives every {right} line its own block, the body its own paragraph", () => {
    assert.deepStrictEqual(
      blockNames("{right}File Code: 1950\n{center}Draft\nDear Party:\nBody"),
      ["right_aligned", "center_aligned", "paragraph"],
    );
  });

  it("writes a line break as a plain newline", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("MARIA DELGADO"),
        schema.node("hard_break"),
        schema.text("District Ranger"),
        schema.node("hard_break"),
      ]),
    ]);
    assert.strictEqual(
      buildContentFromDocument(doc),
      "MARIA DELGADO\nDistrict Ranger",
    );
  });

  it("keeps paragraphs apart even when a split copied the tight flag", () => {
    // Enter inside a paragraph that sat right under a heading gives both
    // halves `tightBefore`; a single newline would merge them on reload.
    const paragraph = (text: string) =>
      schema.node("paragraph", { tightBefore: true }, [schema.text(text)]);
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 2 }, [schema.text("How to Comment")]),
      paragraph("First half."),
      paragraph("Second half."),
    ]);
    assert.strictEqual(
      buildContentFromDocument(doc),
      "## How to Comment\nFirst half.\n\nSecond half.",
    );
  });

  it("leaves placeholders unescaped but still escapes link syntax", () => {
    assert.strictEqual(
      roundTrip("Due [INSERT: comment deadline date || 30 days] to us."),
      "Due [INSERT: comment deadline date || 30 days] to us.",
    );
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("[not](a link)")]),
    ]);
    assert.strictEqual(buildContentFromDocument(doc), "[not\\](a link)");
  });
});

describe("editor block styles", () => {
  before(() => {
    const { document } = parseHTML("<!doctype html><html><body></body></html>");
    Object.assign(globalThis, { document });
  });

  const classOf = (markdown: string) =>
    blockClassFor(buildDocumentFromContent(markdown).child(0));

  it("treats a bold-only paragraph as a section heading", () => {
    assert.strictEqual(classOf("**Purpose and Need**"), SECTION_HEADING_CLASS);
    assert.strictEqual(classOf("**Note:** partly bold"), null);
    assert.strictEqual(classOf("**MARIA DELGADO**\nDistrict Ranger"), null);
  });

  it("marks a closing line alone in its paragraph", () => {
    assert.strictEqual(classOf("Sincerely,"), CLOSING_LINE_CLASS);
    assert.strictEqual(classOf("Respectfully submitted,"), CLOSING_LINE_CLASS);
    assert.strictEqual(classOf("Thank you for your interest."), null);
    assert.strictEqual(classOf("Sincerely,\nMARIA DELGADO"), null);
  });
});
