import type { Node } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Letter layout cues shared with the PDF/DOCX export, applied as node
// decorations (classes styled in globals.css) so they follow edits live and
// never reach the stored markdown:
// - a paragraph that is entirely bold is a section heading ("**Purpose and Need**");
// - a closing line ("Sincerely,") alone in its paragraph leaves room to sign.
export const SECTION_HEADING_CLASS = "doc-section-heading";
export const CLOSING_LINE_CLASS = "doc-closing";

const CLOSING_LINE_REGEX =
  /^(?:sincerely(?: yours)?|respectfully(?: yours| submitted)?|(?:best |kind |warm |warmest )?regards|yours (?:truly|sincerely|faithfully)|very truly yours|cordially|with (?:appreciation|gratitude)|best wishes|thank you),$/i;

const isBoldOnly = (paragraph: Node) => {
  if (paragraph.childCount === 0 || !paragraph.textContent.trim()) {
    return false;
  }
  let isBold = true;
  paragraph.forEach((child) => {
    if (!child.isText || !child.marks.some((m) => m.type.name === "strong")) {
      isBold = false;
    }
  });
  return isBold;
};

export const blockClassFor = (node: Node): string | null => {
  if (node.type.name !== "paragraph") {
    return null;
  }
  if (isBoldOnly(node)) {
    return SECTION_HEADING_CLASS;
  }
  if (CLOSING_LINE_REGEX.test(node.textContent.trim())) {
    return CLOSING_LINE_CLASS;
  }
  return null;
};

const findBlockStyles = (doc: Node): Decoration[] => {
  const decorations: Decoration[] = [];
  // Top-level blocks only: list items and table cells keep their own layout.
  doc.forEach((node, offset) => {
    const className = blockClassFor(node);
    if (className) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, { class: className }),
      );
    }
  });
  return decorations;
};

export const blockStylesPlugin = new Plugin({
  state: {
    init(_, { doc }) {
      return DecorationSet.create(doc, findBlockStyles(doc));
    },
    apply(tr, old) {
      if (tr.docChanged) {
        return DecorationSet.create(tr.doc, findBlockStyles(tr.doc));
      }
      return old;
    },
  },
  props: {
    decorations(state) {
      return this.getState(state) ?? DecorationSet.empty;
    },
  },
});
