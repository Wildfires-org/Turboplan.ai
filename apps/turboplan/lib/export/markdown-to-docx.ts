import type { FileChild, ICommentOptions, IPropertiesOptions } from "docx";

import {
  createPlaceholderRegex,
  PLACEHOLDER_SOURCE,
  parsePlaceholder,
  stripPlaceholderNotesInTableRows,
} from "@/lib/placeholders";

type ParagraphChild = InstanceType<
  | typeof import("docx").TextRun
  | typeof import("docx").CommentRangeStart
  | typeof import("docx").CommentRangeEnd
  | typeof import("docx").CommentReference
>;

// Strips bold/italic markers that directly wrap a placeholder
// (e.g. "**[INSERT X]**" -> "[INSERT X]") so the emphasis characters never leak
// into the export as literal asterisks. Markers separated from the bracket by
// other text (genuine emphasis) are left untouched.
const WRAPPING_EMPHASIS_REGEX = new RegExp(
  `[*_]{1,3}(${PLACEHOLDER_SOURCE})[*_]{1,3}`,
  "g",
);

const stripWrappingEmphasis = (text: string): string =>
  text.replace(WRAPPING_EMPHASIS_REGEX, "$1");

type CommentEntry = {
  id: number;
  description: string;
};

export type DocxLetterheadLogo = {
  data: ArrayBuffer | Uint8Array;
  type: "png" | "jpg";
  width: number; // intrinsic px (for aspect)
  height: number; // intrinsic px
};

// An org/office document footer rendered in the bottom margin of every page:
// a centered tagline, a right-aligned note, and a small left logo. All optional.
export type DocxDocumentFooter = {
  text?: string | null;
  note?: string | null;
  logo?: DocxLetterheadLogo | null;
};

// Footer run size (half-points) and footer-logo display height (px).
const FOOTER_FONT_HALFPT = 17;
const FOOTER_LOGO_HEIGHT = 20;
// Content width (twips) on a default Letter page (12240w − 2×1440 margins): used
// for the footer's center/right tab stops.
const CONTENT_WIDTH_TWIPS = 9360;

// Letterhead logos are scaled to fit this box (px, the unit docx ImageRun
// expects). Kept small enough to sit within the page's left margin (~1 inch =
// 96px) so the letterhead text keeps the full content width.
const LOGO_MAX_WIDTH = 58;
const LOGO_MAX_HEIGHT = 72;

// EMU per pixel at 96 dpi (1px = 1/96in, 1in = 914400 EMU). docx floating
// offsets are in EMU.
const EMU_PER_PX = 9525;

// Horizontal gap (px) between the margin logo and the content edge.
const LOGO_GAP_PX = 6;

// Scales the logo's intrinsic dimensions down to fit the LOGO_MAX box while
// preserving aspect ratio. Never upscales beyond the intrinsic size.
const computeLogoDisplaySize = (
  logo: DocxLetterheadLogo,
): { width: number; height: number } => {
  if (logo.height <= 0 || logo.width <= 0) {
    return { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT };
  }
  const scale = Math.min(
    1,
    LOGO_MAX_WIDTH / logo.width,
    LOGO_MAX_HEIGHT / logo.height,
  );
  return {
    width: Math.round(logo.width * scale),
    height: Math.round(logo.height * scale),
  };
};

// The letterhead logo is a FLOATING image pushed into the LEFT PAGE MARGIN (via
// a negative horizontal offset from the margin), so it sits left of the
// letterhead text without consuming content width — the table stays full-width.
// It is anchored inside the first letterhead cell's paragraph (not its own
// paragraph) so it adds no stray empty line and stays tied to real content.
const buildLetterheadLogoImage = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").ImageRun> => {
  const {
    ImageRun,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    TextWrappingType,
  } = docxModule;
  const { width, height } = computeLogoDisplaySize(logo);
  // Negative offset pushes the image left of the content margin into the margin
  // whitespace; its right edge ends LOGO_GAP_PX before the text.
  const offset = -((width + LOGO_GAP_PX) * EMU_PER_PX);
  return new ImageRun({
    data: logo.data,
    type: logo.type,
    transformation: { width, height },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.MARGIN,
        offset,
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PARAGRAPH,
        offset: 0,
      },
      allowOverlap: true,
      // No text wrapping — the logo lives in the margin, clear of the table.
      wrap: { type: TextWrappingType.NONE },
    },
  });
};

// The default body run size (half-points) from the document styles. The
// letterhead renders ~1.5pt smaller, matching the reference agency letterhead.
const HEADER_FONT_HALFPT = 21;

type RunOptions = {
  // Force bold (letterhead identity columns).
  forceBold?: boolean;
  // Strip all bold emphasis, keeping italic — body text in these official
  // letters carries no bold (only the letterhead and File Code/Date labels do).
  suppressBold?: boolean;
  // Run size override in half-points (e.g. the smaller letterhead font).
  size?: number;
};

const parseInlineFormatting = (
  text: string,
  commentCounter: { value: number },
  comments: CommentEntry[],
  docxModule: typeof import("docx"),
  opts: RunOptions = {},
): ParagraphChild[] => {
  const { TextRun, CommentRangeStart, CommentRangeEnd, CommentReference } =
    docxModule;
  const children: ParagraphChild[] = [];

  const segments = splitByPlaceholders(stripWrappingEmphasis(text));

  for (const segment of segments) {
    if (segment.isPlaceholder) {
      const commentId = commentCounter.value++;
      comments.push({ id: commentId, description: segment.description! });

      children.push(new CommentRangeStart(commentId));
      const runs = parseFormattedRuns(segment.text, docxModule, opts);
      children.push(...runs);
      children.push(new CommentRangeEnd(commentId));
      children.push(
        new TextRun({
          children: [new CommentReference(commentId)],
          style: "CommentReference",
        }),
      );
    } else {
      const runs = parseFormattedRuns(segment.text, docxModule, opts);
      children.push(...runs);
    }
  }

  return children;
};

type TextSegment = {
  text: string;
  isPlaceholder: boolean;
  description?: string;
};

const splitByPlaceholders = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  const regex = createPlaceholderRegex();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isPlaceholder: false,
      });
    }
    // The reviewer note (after "||") becomes the comment body; the anchored
    // text is the placeholder with the note stripped off.
    const { desc, note, visible } = parsePlaceholder(match[0]);
    segments.push({
      text: visible,
      isPlaceholder: true,
      description: note || desc,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isPlaceholder: false,
    });
  }

  return segments;
};

const parseFormattedRuns = (
  text: string,
  docxModule: typeof import("docx"),
  opts: RunOptions = {},
): InstanceType<typeof import("docx").TextRun>[] => {
  const { TextRun } = docxModule;
  const runs: InstanceType<typeof import("docx").TextRun>[] = [];
  const { forceBold = false, suppressBold = false, size } = opts;
  // Marker bold and forced bold both yield to suppression; explicit `false` (not
  // omission) is emitted so it overrides any inherited paragraph/heading style.
  const bold = (value: boolean) => (suppressBold ? false : value);

  // Match bold+italic (***text*** or ___text___), bold (**text** or __text__), italic (*text* or _text_)
  const inlineRegex = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;
  let lastIdx = 0;
  let inlineMatch: RegExpExecArray | null;

  while ((inlineMatch = inlineRegex.exec(text)) !== null) {
    if (inlineMatch.index > lastIdx) {
      runs.push(
        new TextRun({
          text: text.slice(lastIdx, inlineMatch.index),
          bold: bold(forceBold),
          size,
        }),
      );
    }

    if (inlineMatch[1]) {
      runs.push(
        new TextRun({
          text: inlineMatch[2],
          bold: bold(true),
          italics: true,
          size,
        }),
      );
    } else if (inlineMatch[3]) {
      runs.push(new TextRun({ text: inlineMatch[4], bold: bold(true), size }));
    } else if (inlineMatch[5]) {
      runs.push(
        new TextRun({
          text: inlineMatch[6],
          bold: bold(forceBold),
          italics: true,
          size,
        }),
      );
    }

    lastIdx = inlineRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    runs.push(
      new TextRun({ text: text.slice(lastIdx), bold: bold(forceBold), size }),
    );
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: "", size }));
  }

  return runs;
};

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const BULLET_REGEX = /^[\s]*[-*]\s+(.+)$/;
const NUMBERED_REGEX = /^[\s]*\d+\.\s+(.+)$/;
const TABLE_ROW_REGEX = /^\|(.+)\|$/;
const TABLE_SEPARATOR_REGEX = /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/;

const HEADING_LEVELS = [
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "HEADING_4",
  "HEADING_5",
  "HEADING_6",
] as const;

const parseTableRow = (line: string): string[] => {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
};

const buildTable = (
  rows: string[][],
  commentCounter: { value: number },
  comments: CommentEntry[],
  docxModule: typeof import("docx"),
  isHeader = false,
  logo?: DocxLetterheadLogo,
): InstanceType<typeof import("docx").Table> => {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    WidthType,
    BorderStyle,
    TableLayoutType,
    AlignmentType,
    VerticalAlign,
  } = docxModule;

  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };

  const allBordersNone = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  };

  const TABLE_WIDTH = 9360;
  const colCount = rows[0]?.length ?? 0;

  // Preferred 4-col letterhead split in twips (9360 total usable on letter
  // page): Agency 22%, Branch 13%, Forest/District 28%, Address 37%. For any
  // other column count, split evenly so the header never renders ragged. The
  // logo sits in the page margin (see buildLetterheadLogoImage), so the
  // table always uses the full content width.
  const preferredHeaderWidths = [2060, 1215, 2620, 3465];
  const headerColWidths =
    colCount === preferredHeaderWidths.length
      ? preferredHeaderWidths
      : Array.from({ length: colCount }, () =>
          Math.floor(TABLE_WIDTH / Math.max(colCount, 1)),
        );

  const tableRows = rows.map((cells, rowIndex) => {
    const dataCells = cells.map((cellText, colIndex) => {
      const isAddressColumn = colIndex === colCount - 1;
      const formatted = parseInlineFormatting(
        cellText,
        commentCounter,
        comments,
        docxModule,
        {
          // Agency identity columns are bold on real letterheads; the
          // address/contact column (last) stays regular weight.
          forceBold: isHeader && !isAddressColumn,
          // The letterhead renders slightly smaller than the body.
          size: isHeader ? HEADER_FONT_HALFPT : undefined,
        },
      );
      // Anchor the floating margin logo to the first letterhead cell's paragraph
      // (the floating image doesn't disturb the inline text). This avoids a
      // stray empty anchor paragraph above the table.
      const cellChildren =
        isHeader && logo && rowIndex === 0 && colIndex === 0
          ? [buildLetterheadLogoImage(logo, docxModule), ...formatted]
          : formatted;
      return new TableCell({
        children: [
          new Paragraph({
            children: cellChildren,
            alignment:
              isHeader && isAddressColumn ? AlignmentType.RIGHT : undefined,
            // Single-spaced with no trailing gap keeps letterhead rows tight
            // instead of inheriting the body paragraph's after-spacing.
            spacing: isHeader ? { after: 0, line: 240 } : undefined,
          }),
        ],
        borders: allBordersNone,
        verticalAlign: isHeader ? VerticalAlign.CENTER : undefined,
        margins: isHeader
          ? { top: 20, bottom: 20, left: 0, right: 120 }
          : undefined,
        width: isHeader
          ? { size: headerColWidths[colIndex], type: WidthType.DXA }
          : undefined,
      });
    });

    return new TableRow({ children: dataCells });
  });

  const fixedLayout = isHeader
    ? { columnWidths: headerColWidths, layout: TableLayoutType.FIXED }
    : {};

  return new Table({
    rows: tableRows,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    ...fixedLayout,
  });
};

// A standard full-width horizontal rule (an empty paragraph with a bottom
// border — the same construct Word produces from a "---" line), used to
// separate the letterhead from the document body.
const buildHorizontalRule = (
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").Paragraph> => {
  const { Paragraph, BorderStyle } = docxModule;
  return new Paragraph({
    spacing: { before: 40, after: 160 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: "000000",
        space: 1,
      },
    },
  });
};

// Decodes the handful of HTML entities the editor can emit so they never render
// literally (e.g. `&nbsp;` spacer lines in the signature block). `&nbsp;` →
// regular space so a line that was only `&nbsp;` collapses to an empty line.
const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

// A markdown thematic break (`---`, `***`, `___`) — dropped, never rendered as
// literal text (the letterhead draws its own separator).
const THEMATIC_BREAK_REGEX = /^\s*([-*_])\1{2,}\s*$/;

// Footer logo: inline image scaled to FOOTER_LOGO_HEIGHT, preserving aspect.
const buildFooterLogoImage = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").ImageRun> => {
  const { ImageRun } = docxModule;
  const scale =
    logo.height > 0 ? Math.min(1, FOOTER_LOGO_HEIGHT / logo.height) : 1;
  const width =
    logo.width > 0 ? Math.round(logo.width * scale) : FOOTER_LOGO_HEIGHT;
  const height =
    logo.height > 0 ? Math.round(logo.height * scale) : FOOTER_LOGO_HEIGHT;
  return new ImageRun({
    data: logo.data,
    type: logo.type,
    transformation: { width, height },
  });
};

// Builds the page footer: a single tab-stopped paragraph with the logo at the
// left, the tagline centered, and the note right-aligned — all in the bottom
// margin band, repeated on every page.
const buildDocumentFooter = (
  footer: DocxDocumentFooter,
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").Footer> => {
  const { Footer, Paragraph, TextRun, Tab, TabStopType } = docxModule;
  const children: ParagraphChild[] = [];
  if (footer.logo) {
    children.push(buildFooterLogoImage(footer.logo, docxModule));
  }
  // Tab to the center stop, then the tagline; tab to the right stop, then note.
  children.push(
    new TextRun({ children: [new Tab()], size: FOOTER_FONT_HALFPT }),
    new TextRun({ text: footer.text ?? "", size: FOOTER_FONT_HALFPT }),
    new TextRun({ children: [new Tab()], size: FOOTER_FONT_HALFPT }),
    new TextRun({ text: footer.note ?? "", size: FOOTER_FONT_HALFPT }),
  );
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [
          {
            type: TabStopType.CENTER,
            position: Math.round(CONTENT_WIDTH_TWIPS / 2),
          },
          { type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIPS },
        ],
        children,
      }),
    ],
  });
};

// Right-aligned page number header (pages 2+). Page 1 uses an empty header so it
// carries no number, matching standard agency letters.
const buildPageNumberHeader = (
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").Header> => {
  const { Header, Paragraph, TextRun, PageNumber, AlignmentType } = docxModule;
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  });
};

const buildEmptyHeader = (
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").Header> => {
  const { Header, Paragraph } = docxModule;
  return new Header({ children: [new Paragraph({})] });
};

export const generateDocxFromMarkdown = async (
  content: string,
  title: string,
  logo?: DocxLetterheadLogo,
  footer?: DocxDocumentFooter,
): Promise<Blob> => {
  const docx = await import("docx");
  const { Document, Paragraph, Packer, HeadingLevel, AlignmentType } = docx;

  const hasFooter = !!(footer && (footer.text || footer.note || footer.logo));
  // A document is "branded" when it carries a letterhead logo or footer. Only
  // branded documents get page-number chrome; plain exports keep their layout.
  const isBranded = !!logo || hasFooter;

  // Strip "|| note" from placeholders inside table rows before anything else —
  // their pipes would shift parseTableRow's cell split. Covers documents stored
  // before the server-side sanitizer existed.
  const normalizedContent = stripPlaceholderNotesInTableRows(
    decodeHtmlEntities(content),
  )
    .replace(/\\([[\]()])/g, "$1")
    .replace(/(?<=.) *\{right\}/g, "\n{right}");

  const comments: CommentEntry[] = [];
  const commentCounter = { value: 0 };
  const paragraphs: FileChild[] = [];
  let isFirstTable = true;

  const lines = normalizedContent.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Thematic break (`---`, `***`, `___`): drop it — should never render as
    // literal "---" text in the body.
    if (THEMATIC_BREAK_REGEX.test(line)) {
      i++;
      continue;
    }

    // Table: collect all consecutive table rows
    if (TABLE_ROW_REGEX.test(line)) {
      const tableRows: string[][] = [];
      while (i < lines.length && TABLE_ROW_REGEX.test(lines[i])) {
        if (!TABLE_SEPARATOR_REGEX.test(lines[i])) {
          tableRows.push(parseTableRow(lines[i]));
        }
        i++;
      }
      if (tableRows.length > 0) {
        const wasHeaderTable = isFirstTable;
        // The logo only decorates the first table (the letterhead). It floats in
        // the left margin, anchored inside the table's first cell (no extra
        // paragraph), so it adds no blank line above the letterhead.
        paragraphs.push(
          buildTable(
            tableRows,
            commentCounter,
            comments,
            docx,
            isFirstTable,
            isFirstTable ? logo : undefined,
          ),
        );
        isFirstTable = false;
        if (wasHeaderTable) {
          paragraphs.push(buildHorizontalRule(docx));
        }
      }
      continue;
    }

    // Right-aligned paragraph: {right}text
    if (line.startsWith("{right}")) {
      const text = line.slice(7);
      const children = parseInlineFormatting(
        text,
        commentCounter,
        comments,
        docx,
      );
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children,
        }),
      );
      i++;
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      const level = headingMatch[1].length - 1;
      const headingText = headingMatch[2].trim();
      // Headings carry no bold (official letters); explicit non-bold runs
      // override the Word heading style's default bold.
      const children = parseInlineFormatting(
        headingText,
        commentCounter,
        comments,
        docx,
        { suppressBold: true },
      );
      paragraphs.push(
        new Paragraph({
          heading:
            HeadingLevel[HEADING_LEVELS[level] as keyof typeof HeadingLevel],
          children,
        }),
      );
      i++;
      continue;
    }

    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch) {
      const children = parseInlineFormatting(
        bulletMatch[1],
        commentCounter,
        comments,
        docx,
        { suppressBold: true },
      );
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children,
        }),
      );
      i++;
      continue;
    }

    const numberedMatch = line.match(NUMBERED_REGEX);
    if (numberedMatch) {
      const children = parseInlineFormatting(
        numberedMatch[1],
        commentCounter,
        comments,
        docx,
        { suppressBold: true },
      );
      paragraphs.push(
        new Paragraph({
          numbering: { reference: "default-numbering", level: 0 },
          children,
        }),
      );
      i++;
      continue;
    }

    // Regular body paragraph — no bold.
    const children = parseInlineFormatting(
      line,
      commentCounter,
      comments,
      docx,
      {
        suppressBold: true,
      },
    );
    paragraphs.push(new Paragraph({ children, spacing: { after: 200 } }));
    i++;
  }

  const commentDefinitions: ICommentOptions[] = comments.map((c) => ({
    id: c.id,
    author: "TurboPlan",
    initials: "TC",
    date: new Date(),
    children: [new Paragraph(c.description)],
  }));

  const fileOptions: IPropertiesOptions = {
    title,
    creator: "TurboPlan",
    // Serif body font to match standard agency letterhead documents.
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
      },
    },
    comments: { children: commentDefinitions },
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: docx.LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        // Page numbers + titlePage are letterhead chrome — only applied to
        // branded documents (a logo or footer is configured) so plain exports
        // keep their previous, unnumbered layout.
        ...(isBranded
          ? {
              // titlePage lets page 1 use an empty header (no page number),
              // while pages 2+ get the right-aligned number — matching agency
              // letters.
              properties: { titlePage: true },
              headers: {
                default: buildPageNumberHeader(docx),
                first: buildEmptyHeader(docx),
              },
            }
          : {}),
        // The footer (when configured) repeats on every page, including page 1.
        ...(hasFooter && footer
          ? {
              footers: {
                default: buildDocumentFooter(footer, docx),
                first: buildDocumentFooter(footer, docx),
              },
            }
          : {}),
        children: paragraphs,
      },
    ],
  };

  const doc = new Document(fileOptions);
  return Packer.toBlob(doc);
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const sanitizeFilename = (title: string): string => {
  const cleaned = title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return `${cleaned || "document"}.docx`;
};
