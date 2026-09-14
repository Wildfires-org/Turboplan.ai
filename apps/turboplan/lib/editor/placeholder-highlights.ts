import type { Node } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import {
  createPlaceholderRegex,
  PLACEHOLDER_NOTE_SEPARATOR,
} from "@/lib/placeholders";

const PLACEHOLDER_REGEX = createPlaceholderRegex();

const findPlaceholders = (doc: Node): Decoration[] => {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      // Keep descending into containers (lists, blockquotes, table cells).
      return true;
    }

    // Scan the block's concatenated inline text, not individual text nodes: a
    // mark boundary inside a token (e.g. an autolinked URL in a placeholder's
    // suggested value) splits the token across text nodes, and a per-node scan
    // would miss it. Non-text leaves map to a single ￼ so string offsets
    // stay aligned with document positions.
    const text = node.textBetween(0, node.content.size, "￼", "￼");
    let match: RegExpExecArray | null;
    PLACEHOLDER_REGEX.lastIndex = 0;

    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const token = match[0];
      const from = pos + 1 + match.index;
      const to = from + token.length;
      decorations.push(
        Decoration.inline(from, to, {
          class: "placeholder-highlight",
        }),
      );

      // Reviewer-guidance notes ("|| ...") live in the document so they survive
      // edits and reach the docx export, but must stay off-screen. Hide the
      // note span — from the separator (and any space before it) through the
      // char before the closing "]" — so the editor shows only "[INSERT: desc]".
      const sep = token.indexOf(PLACEHOLDER_NOTE_SEPARATOR);
      if (sep !== -1) {
        let noteStart = sep;
        while (noteStart > 0 && token[noteStart - 1] === " ") {
          noteStart--;
        }
        decorations.push(
          Decoration.inline(from + noteStart, to - 1, {
            class: "placeholder-note-hidden",
          }),
        );
      }
    }

    // The block's inline content is fully handled — no need to visit children.
    return false;
  });

  return decorations;
};

export const placeholderHighlightPlugin = new Plugin({
  state: {
    init(_, { doc }) {
      return DecorationSet.create(doc, findPlaceholders(doc));
    },
    apply(tr, old) {
      if (tr.docChanged) {
        return DecorationSet.create(tr.doc, findPlaceholders(tr.doc));
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
