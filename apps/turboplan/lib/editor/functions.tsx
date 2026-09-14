"use client";

import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import { DOMParser, type Node } from "prosemirror-model";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { renderToString } from "react-dom/server";

import { Markdown } from "@/components/markdown";
import { documentSchema } from "./config";
import { createSuggestionWidget, type UISuggestion } from "./suggestions";

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table: (state: MarkdownSerializerState, node: Node) => {
      const serializeInline = (cell: Node): string => {
        let result = "";
        cell.forEach((child) => {
          let text = child.textContent;
          if (child.isText && child.marks.length > 0) {
            const hasStrong = child.marks.some((m) => m.type.name === "strong");
            const hasEm = child.marks.some((m) => m.type.name === "em");
            const hasCode = child.marks.some((m) => m.type.name === "code");
            if (hasCode) {
              text = `\`${text}\``;
            } else if (hasStrong && hasEm) {
              text = `***${text}***`;
            } else if (hasStrong) {
              text = `**${text}**`;
            } else if (hasEm) {
              text = `*${text}*`;
            }
          }
          result += text;
        });
        return result;
      };

      const rows: string[][] = [];
      node.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => {
          cells.push(serializeInline(cell));
        });
        rows.push(cells);
      });
      if (rows.length === 0) {
        return;
      }
      const colCount = rows[0].length;
      const colWidths = Array.from({ length: colCount }, () => 3);
      for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
          colWidths[c] = Math.max(colWidths[c], row[c].length);
        }
      }
      const formatRow = (row: string[]) =>
        `|${row.map((cell, c) => ` ${cell.padEnd(colWidths[c])} `).join("|")}|`;

      state.text(formatRow(rows[0]) + "\n");
      const sep = colWidths.map((w) => "-".repeat(w + 2)).join("|");
      state.text(`|${sep}|\n`);
      for (let r = 1; r < rows.length; r++) {
        state.text(formatRow(rows[r]) + "\n");
      }
      state.closeBlock(node);
    },
    table_row: () => {},
    table_cell: () => {},
    right_aligned: (state: MarkdownSerializerState, node: Node) => {
      state.write("{right}");
      state.renderInline(node);
      state.closeBlock(node);
    },
  },
  defaultMarkdownSerializer.marks,
);

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  // Keep reviewer-guidance notes ("|| ...") in the document so editor edits
  // round-trip them back to storage and the docx export can still turn them
  // into comments. They are hidden on screen by placeholderHighlightPlugin.
  const stringFromMarkdown = renderToString(
    <Markdown stripNotes={false}>{content}</Markdown>,
  );
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};

export const buildContentFromDocument = (document: Node) => {
  return markdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: Array<UISuggestion>,
  view: EditorView,
) => {
  const decorations: Array<Decoration> = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        },
      ),
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (view) => {
          const { dom } = createSuggestionWidget(suggestion, view);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: "widget",
        },
      ),
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};
