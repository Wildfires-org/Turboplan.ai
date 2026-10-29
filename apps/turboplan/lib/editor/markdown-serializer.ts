import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Mark, Node } from "prosemirror-model";

// GFM separator cell carrying the column's alignment marker, so an edited
// letterhead keeps its explicit layout (a bare `---` would silently downgrade
// it to the legacy agency defaults).
const separatorCell = (align: unknown): string => {
  if (align === "left") {
    return ":---";
  }
  if (align === "right") {
    return "---:";
  }
  if (align === "center") {
    return ":---:";
  }
  return "---";
};

// Tables are written compactly ("| a | b |", "|---|---|"), the way the AI
// writes them, so an edit doesn't reformat every table in the document.
const formatRow = (cells: string[]) =>
  `|${cells.map((cell) => (cell ? ` ${cell} ` : " ")).join("|")}|`;

// The default escaping turns every "[" and "]" into "\[" / "\]", so a
// placeholder like "[INSERT: date]" would be stored as "\[INSERT: date\]"
// after any edit, which the placeholder tooling and the exports don't expect.
// A bracket only needs escaping where it could form a link: keep "\]" before
// "(", "[" or ":" and unescape every other bracket. The lookbehind skips an
// escaped backslash ("\\[" is a literal backslash, then a bracket).
const ESCAPED_BRACKET_REGEX = /(?<!\\)((?:\\\\)*)\\([[\]])(?![([:])/g;

// A lone "~" ("~2,500 acres") can't open a strikethrough.
const LONE_ESCAPED_TILDE_REGEX = /^([^~]*)\\~([^~]*)$/;

const unescapeText = (text: string) =>
  text
    .replace(ESCAPED_BRACKET_REGEX, "$1$2")
    .replace(LONE_ESCAPED_TILDE_REGEX, "$1~$2");

// Serializer state members the package uses internally but leaves out of its
// type declarations: `inAutolink` is set while a bare link's text is written
// (so it isn't escaped), `atBlockStart` while at the start of a block, and
// `flushClose(1)` ends the previous block with a single newline.
type InternalState = MarkdownSerializerState & {
  inAutolink?: boolean;
  atBlockStart: boolean;
  flushClose: (size?: number) => void;
};

type BlockSerializer = (
  state: MarkdownSerializerState,
  node: Node,
  parent: Node,
  index: number,
) => void;

// Blocks after which a following line would be swallowed: a list continues
// lazily, a table takes it as a row, a paragraph merges it.
const SWALLOWING_BLOCKS = new Set([
  "bullet_list",
  "ordered_list",
  "table",
  "blockquote",
  "code_block",
]);

const canSitTight = (previous: Node, node: Node) => {
  if (SWALLOWING_BLOCKS.has(previous.type.name)) {
    return false;
  }
  if (previous.type.name === "paragraph" && node.type.name === "paragraph") {
    return false;
  }
  // Only a list starting at 1 can interrupt a paragraph.
  return !(node.type.name === "ordered_list" && node.attrs.order !== 1);
};

// A block marked `tightBefore` (see config.ts) goes on the line right after the
// previous block, as in the source, instead of after a blank line. Checked
// against its neighbour, since editing can move or split blocks.
const tight =
  (serialize: BlockSerializer): BlockSerializer =>
  (state, node, parent, index) => {
    if (
      node.attrs.tightBefore &&
      index > 0 &&
      canSitTight(parent.child(index - 1), node)
    ) {
      (state as InternalState).flushClose(1);
    }
    serialize(state, node, parent, index);
  };

const alignedLine =
  (marker: string): BlockSerializer =>
  (state, node) => {
    state.write(marker);
    state.renderInline(node);
    state.closeBlock(node);
  };

const isBareLink = (mark: Mark, parent: Node, index: number) => {
  const content = parent.child(index);
  const href = String(mark.attrs.href ?? "");
  if (mark.attrs.title || !content.isText) {
    return false;
  }
  const text = content.text ?? "";
  // GFM percent-encodes the href ("…?project=[ID]" → "…%5BID"), and gives a
  // "www." literal an "http://" prefix.
  return [text, encodeURI(text), `http://${text}`, `mailto:${text}`].includes(
    href,
  );
};

type MarkClose = (
  state: MarkdownSerializerState,
  mark: Mark,
  parent: Node,
  index: number,
) => string;

const defaultLinkClose = defaultMarkdownSerializer.marks.link
  .close as MarkClose;

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
          let text = hasCode
            ? child.textContent
            : unescapeText(state.esc(child.textContent));
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
      // GFM aligns whole columns, so the first row's cells carry it.
      const firstRow = node.firstChild;
      const sep = rows[0]
        .map((_, c) =>
          separatorCell(
            firstRow && c < firstRow.childCount
              ? firstRow.child(c).attrs.align
              : null,
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
    paragraph: tight(defaultMarkdownSerializer.nodes.paragraph),
    heading: tight(defaultMarkdownSerializer.nodes.heading),
    // "-" bullets, and no blank line between the items of a tight list (see
    // the `tight` attr in config.ts), as the AI writes them.
    bullet_list: tight((state, node) => {
      state.renderList(node, "  ", () => "- ");
    }),
    // Unpadded numbers ("9." and "10.", not " 9."), as the AI writes them.
    ordered_list: tight((state, node) => {
      const start = Number(node.attrs.order ?? 1);
      const width = String(start + node.childCount - 1).length;
      state.renderList(node, " ".repeat(width + 2), (i) => `${start + i}. `);
    }),
    right_aligned: tight(alignedLine("{right}")),
    center_aligned: tight(alignedLine("{center}")),
    // A line break inside a paragraph is a plain newline in the document
    // dialect (see remarkLineBreaks), not CommonMark's backslash break.
    // Trailing breaks are dropped, as in the default serializer.
    hard_break: (
      state: MarkdownSerializerState,
      node: Node,
      parent: Node,
      index: number,
    ) => {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("\n");
          return;
        }
      }
    },
    text: (state: MarkdownSerializerState, node: Node) => {
      const text = node.text ?? "";
      if ((state as InternalState).inAutolink) {
        state.text(text, false);
        return;
      }
      state.text(
        unescapeText(state.esc(text, (state as InternalState).atBlockStart)),
        false,
      );
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    // A bare URL or email (a GFM autolink literal in the source) is written
    // back bare, not as "<https://…>" or "[a@b.c](mailto:a@b.c)".
    link: {
      open: (state, mark, parent, index) => {
        const isBare = isBareLink(mark, parent, index);
        (state as InternalState).inAutolink = isBare;
        return isBare ? "" : "[";
      },
      close: (state, mark, parent, index) => {
        if ((state as InternalState).inAutolink) {
          (state as InternalState).inAutolink = undefined;
          return "";
        }
        return defaultLinkClose(state, mark, parent, index);
      },
      mixable: true,
    },
  },
);

export const buildContentFromDocument = (document: Node) => {
  return markdownSerializer.serialize(document);
};
