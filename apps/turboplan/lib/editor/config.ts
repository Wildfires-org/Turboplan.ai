import type { MutableRefObject } from "react";

import { textblockTypeInputRule } from "prosemirror-inputrules";
import { type NodeSpec, Schema } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { buildContentFromDocument } from "./markdown-serializer";

// Extends a node spec with attrs read off its DOM element at parse time.
const withParsedAttrs = (
  spec: NodeSpec,
  attrs: NodeSpec["attrs"],
  read: (dom: HTMLElement) => Record<string, unknown>,
): NodeSpec => ({
  ...spec,
  attrs: { ...spec.attrs, ...attrs },
  parseDOM: spec.parseDOM?.map((rule) => ({
    ...rule,
    getAttrs: (dom: HTMLElement) => {
      const base = rule.getAttrs ? rule.getAttrs(dom) : rule.attrs;
      if (base === false) {
        return false;
      }
      return { ...base, ...read(dom) };
    },
  })),
});

// `tightBefore`: the block started on the line right after the previous one
// in the source markdown, not after a blank line (see rehypeTightBlocks). The
// serializer writes it back the same way.
const withTightBefore = (spec: NodeSpec | undefined) =>
  withParsedAttrs(spec ?? {}, { tightBefore: { default: false } }, (dom) => ({
    tightBefore: dom.hasAttribute("data-tight-before"),
  }));

// A list is tight (no blank line between items) unless its items are wrapped
// in paragraphs, which is how the markdown HTML marks a loose list.
const isTightList = (dom: HTMLElement) =>
  !Array.from(dom.children).some(
    (item) => item.firstElementChild?.tagName === "P",
  );

const withListAttrs = (spec: NodeSpec | undefined) =>
  withParsedAttrs(
    withTightBefore(spec),
    { tight: { default: true } },
    (dom) => ({ tight: isTightList(dom) }),
  );

const listNodes = addListNodes(schema.spec.nodes, "paragraph block*", "block");

const baseNodes = listNodes
  .update("paragraph", withTightBefore(listNodes.get("paragraph")))
  .update("heading", withTightBefore(listNodes.get("heading")))
  .update("bullet_list", withListAttrs(listNodes.get("bullet_list")))
  .update("ordered_list", withListAttrs(listNodes.get("ordered_list")));

// The document HTML comes from components/markdown.tsx, which renders **bold**
// as `span.font-semibold` rather than <strong>. Parse that back to the strong
// mark, or every edit would drop the document's bold (e.g. a letterhead's firm
// name, whose explicit layout takes bold from the markdown only).
const baseStrong = schema.spec.marks.get("strong");
const baseMarks = schema.spec.marks.update("strong", {
  ...baseStrong,
  parseDOM: [...(baseStrong?.parseDOM ?? []), { tag: "span.font-semibold" }],
});

// A `{right}` / `{center}` line.
const alignedLineSpec = (className: string): NodeSpec =>
  withTightBefore({
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: `p.${className}`, priority: 60 }],
    toDOM: () => ["p", { class: className }, 0],
  });

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
    .addToEnd("right_aligned", alignedLineSpec("text-right"))
    .addToEnd("center_aligned", alignedLineSpec("text-center")),
  marks: baseMarks,
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
