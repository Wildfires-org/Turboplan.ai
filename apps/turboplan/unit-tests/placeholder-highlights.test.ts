import assert from "node:assert";
import { describe, it } from "node:test";
import { Schema } from "prosemirror-model";
import type { DecorationSet } from "prosemirror-view";

import { placeholderHighlightPlugin } from "../lib/editor/placeholder-highlights";

// Minimal schema with a link mark — enough to reproduce the autolink case
// where a URL inside a placeholder splits the token across text nodes.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: {
    link: { attrs: { href: {} } },
  },
});

const decorationsFor = (doc: ReturnType<typeof schema.node>): DecorationSet => {
  const init = placeholderHighlightPlugin.spec.state?.init;
  assert.ok(init, "plugin must define state.init");
  // biome-ignore lint/suspicious/noExplicitAny: minimal fake init args for test
  return init.call(placeholderHighlightPlugin, {} as any, { doc } as any);
};

describe("placeholderHighlightPlugin", () => {
  it("decorates a token contained in a single text node", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("Submit by [INSERT: comment deadline date] to the office."),
      ]),
    ]);
    const decos = decorationsFor(doc).find();
    assert.strictEqual(decos.length, 1);
  });

  it("decorates a token split by an autolinked URL", () => {
    const link = schema.mark("link", {
      href: "https://www.fs.usda.gov/project/",
    });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text(
          "available online at: [INSERT: project web page URL — suggested: ",
        ),
        schema.text("https://www.fs.usda.gov/project/", [link]),
        schema.text(
          " — verify the assigned project number and full URL for this project]",
        ),
      ]),
    ]);
    const decos = decorationsFor(doc).find();
    assert.strictEqual(decos.length, 1);

    // The decoration must cover the entire token, from "[" to "]".
    const para = doc.firstChild;
    assert.ok(para);
    const text = para.textContent;
    const tokenStart = text.indexOf("[INSERT:");
    const tokenEnd = text.indexOf("]", tokenStart) + 1;
    assert.strictEqual(decos[0].from, 1 + tokenStart);
    assert.strictEqual(decos[0].to, 1 + tokenEnd);
  });

  it("decorates a token split by an autolinked email and hides its note", () => {
    const link = schema.mark("link", { href: "mailto:john.brokaw@usda.gov" });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("to: [INSERT: project contact email — suggested: "),
        schema.text("john.brokaw@usda.gov", [link]),
        schema.text(
          " || taken from the reference letter, confirm for this project].",
        ),
      ]),
    ]);
    const decos = decorationsFor(doc).find();
    // One highlight decoration + one note-hiding decoration.
    assert.strictEqual(decos.length, 2);
  });

  it("decorates tokens inside separate paragraphs independently", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("{right}File Code: [INSERT: file code — suggested: 1950]"),
      ]),
      schema.node("paragraph", null, [
        schema.text("Sincerely, [INSERT: District Ranger name]"),
      ]),
    ]);
    const decos = decorationsFor(doc).find();
    assert.strictEqual(decos.length, 2);
  });
});
