import type { MutableRefObject } from "react";

import { textblockTypeInputRule } from "prosemirror-inputrules";
import { Schema } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { buildContentFromDocument } from "./functions";

const baseNodes = addListNodes(schema.spec.nodes, "paragraph block*", "block");

export const documentSchema = new Schema({
  nodes: baseNodes
    .addToEnd("table", {
      content: "table_row+",
      group: "block",
      tableRole: "table",
      parseDOM: [{ tag: "table" }],
      toDOM: () => [
        "table",
        { class: "w-full border-collapse my-2" },
        ["tbody", 0],
      ],
    })
    .addToEnd("table_row", {
      content: "table_cell+",
      tableRole: "row",
      parseDOM: [{ tag: "tr" }],
      toDOM: () => ["tr", 0],
    })
    .addToEnd("table_cell", {
      content: "inline*",
      tableRole: "cell",
      attrs: { align: { default: null } },
      parseDOM: [
        {
          tag: "td",
          getAttrs: (dom: HTMLElement) => ({
            align: dom.style.textAlign || dom.getAttribute("align") || null,
          }),
        },
        {
          tag: "th",
          getAttrs: (dom: HTMLElement) => ({
            align: dom.style.textAlign || dom.getAttribute("align") || null,
          }),
        },
      ],
      toDOM: (node) => {
        const attrs: Record<string, string> = {
          class: "border border-gray-200 dark:border-zinc-700 px-3 py-1.5",
        };
        if (node.attrs.align) {
          attrs.style = `text-align: ${node.attrs.align}`;
        }
        return ["td", attrs, 0] as const;
      },
    })
    .addToEnd("right_aligned", {
      content: "inline*",
      group: "block",
      parseDOM: [
        {
          tag: "p.text-right",
          priority: 60,
        },
      ],
      toDOM: () => ["p", { class: "text-right" }, 0],
    }),
  marks: schema.spec.marks,
});

export function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    documentSchema.nodes.heading,
    () => ({ level }),
  );
}

export const handleTransaction = ({
  transaction,
  editorRef,
  onSaveContent,
}: {
  transaction: Transaction;
  editorRef: MutableRefObject<EditorView | null>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  if (!editorRef || !editorRef.current) return;

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  if (transaction.docChanged && !transaction.getMeta("no-save")) {
    const updatedContent = buildContentFromDocument(newState.doc);

    if (transaction.getMeta("no-debounce")) {
      onSaveContent(updatedContent, false);
    } else {
      onSaveContent(updatedContent, true);
    }
  }
};
