import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Node } from "prosemirror-model";

// GFM separator cell for a column of the given content width, carrying the
// column's alignment marker so an edited letterhead keeps its explicit layout
// (a bare `---` would silently downgrade it to the legacy agency defaults).
const separatorCell = (align: unknown, width: number): string => {
  if (align === "left") {
    return `:${"-".repeat(width + 1)}`;
  }
  if (align === "right") {
    return `${"-".repeat(width + 1)}:`;
  }
  if (align === "center") {
    return `:${"-".repeat(width)}:`;
  }
  return "-".repeat(width + 2);
};

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table: (state: MarkdownSerializerState, node: Node) => {
      const serializeInline = (cell: Node): string => {
        let result = "";
        cell.forEach((child) => {
          const hasCode = child.marks.some((m) => m.type.name === "code");
          // Escape the cell's own text, not the emphasis markers added below:
          // rows are written unescaped, or "**bold**" would come back as
          // "\*\*bold\*\*" and lose its bold after every edit.
          let text = hasCode ? child.textContent : state.esc(child.textContent);
          if (child.isText && child.marks.length > 0) {
            const hasStrong = child.marks.some((m) => m.type.name === "strong");
            const hasEm = child.marks.some((m) => m.type.name === "em");
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

      // GFM aligns whole columns, so the first row's cells carry it.
      const firstRow = node.firstChild;
      const sep = colWidths
        .map((w, c) =>
          separatorCell(
            firstRow && c < firstRow.childCount
              ? firstRow.child(c).attrs.align
              : null,
            w,
          ),
        )
        .join("|");

      state.text(`${formatRow(rows[0])}\n`, false);
      state.text(`|${sep}|\n`, false);
      for (let r = 1; r < rows.length; r++) {
        state.text(`${formatRow(rows[r])}\n`, false);
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
    center_aligned: (state: MarkdownSerializerState, node: Node) => {
      state.write("{center}");
      state.renderInline(node);
      state.closeBlock(node);
    },
  },
  defaultMarkdownSerializer.marks,
);

export const buildContentFromDocument = (document: Node) => {
  return markdownSerializer.serialize(document);
};
