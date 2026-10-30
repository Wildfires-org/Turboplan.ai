import type { FileChild, ICommentOptions, IPropertiesOptions } from "docx";

import {
  cleanGridLineText,
  GRID_LINE_SCALE,
  type GridSegment,
  gridBaseFontRatio,
  gridLogoCells,
  gridLogoSize,
  type LetterheadLogoPlacement,
  layoutGridLetterhead,
  type PublicGridLetterhead,
  type PublicGridLetterheadCell,
} from "@wildfires-org/turboplan-workspace/types";

import {
  type ColumnAlignment,
  computeColumnWidths,
  estimateTextWidthEm,
  hasExplicitAlignment,
  parseTableAlignments,
} from "@/lib/export/letterhead-layout";
import {
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

// A letterhead copied from a reference document (or saved from one as the
// office/org default), drawn from its structure instead of a markdown table:
// one row of cells at their `x` / `width` fractions of the content width
// (lay out with `layoutGridLetterhead`). `logos[cell.index]` holds a logo
// cell's image (null when it did not load — draw nothing there). The content
// carries no letterhead table then; `letterheadColor` is the grid's colour,
// and `logo` (placement "margin") is set only for a grid without logo cells
// (the office → org letterhead logo, drawn in the margin as before).
export type DocxGridLetterhead = {
  grid: PublicGridLetterhead;
  logos: (DocxLetterheadLogo | null)[];
};

export type DocxExportOptions = {
  gridLetterhead?: DocxGridLetterhead;
};

// Portability: the export must render the same in Word, Pages, Google Docs and
// LibreOffice, so it only uses widely supported OOXML — inline images (never
// floating/anchored ones), table borders for rules, explicit paragraph
// spacing, and a styles.xml with a DEFAULT paragraph style (see
// DEFAULT_STYLES_XML; without one Pages drops all direct paragraph formatting).

// Footer run size (half-points) and footer-logo display height (px).
const FOOTER_FONT_HALFPT = 17;
const FOOTER_LOGO_HEIGHT = 20;
// Content width (twips) of the page docx generates by default — A4 (11906w)
// minus 2×1440 margins. The letterhead table spans it, and the footer's
// center/right tab stops sit on it.
const CONTENT_WIDTH_TWIPS = 9026;

// Body text (shared with the PDF export and the editor preview): 11pt, 1.15
// line spacing, 8pt after, no indents.
const BODY_FONT_HALFPT = 22;
const BODY_LINE_TWIPS = 276; // 240 = single, "auto" rule
const PARAGRAPH_AFTER_TWIPS = 160;
// Section headings: 12pt before, 4pt after, kept with the next paragraph.
const HEADING_BEFORE_TWIPS = 240;
const HEADING_AFTER_TWIPS = 80;
// Markdown heading sizes (half-points) by level 1-6.
const HEADING_SIZES_HALFPT = [40, 30, 26, 24, 22, 22];
// Signature space below a complimentary close ("Sincerely,").
const CLOSING_AFTER_TWIPS = 720;
// Space after each list item.
const LIST_ITEM_AFTER_TWIPS = 60;
// Gap below a body table (an empty spacer paragraph).
const TABLE_GAP_TWIPS = 120;
// Gap between the letterhead rule and the body.
const LETTERHEAD_GAP_TWIPS = 200;
// The rule under the letterhead: a 0.75pt (eighths of a point) table border.
const RULE_SIZE = 6;

type LogoBox = { width: number; height: number };

// Letterhead logos are scaled to fit a box (px, the unit docx ImageRun
// expects). Placements (see LETTERHEAD_LOGO_PLACEMENT): "margin" (agency
// columns and AI-written letterheads) puts a narrow ~0.6in logo in its own
// first letterhead column; "inline" ("split") puts a larger ~0.9in logo there;
// "above" centers it above the table ("centered").
const LOGO_BOXES: Record<
  Exclude<LetterheadLogoPlacement, "banner">,
  LogoBox
> = {
  margin: { width: 58, height: 72 },
  inline: { width: 144, height: 86 },
  above: { width: 192, height: 72 },
};

// Twips per pixel at 96 dpi (1in = 1440 twips = 96px).
const TWIPS_PER_PX = 15;

// Gap (twips) between the logo column and the letterhead text.
const LOGO_COLUMN_GAP_TWIPS = 180;

// Scales the logo's intrinsic dimensions down to fit its placement's box while
// preserving aspect ratio. Never upscales beyond the intrinsic size.
const computeLogoDisplaySize = (
  logo: DocxLetterheadLogo,
  placement: keyof typeof LOGO_BOXES = "margin",
): LogoBox => {
  const box = LOGO_BOXES[placement];
  if (logo.height <= 0 || logo.width <= 0) {
    return box;
  }
  const scale = Math.min(1, box.width / logo.width, box.height / logo.height);
  return {
    width: Math.round(logo.width * scale),
    height: Math.round(logo.height * scale),
  };
};

// Width (twips) of the letterhead's logo column: the logo plus a gutter.
const logoColumnTwips = (
  logo: DocxLetterheadLogo,
  placement: "margin" | "inline",
): number =>
  computeLogoDisplaySize(logo, placement).width * TWIPS_PER_PX +
  LOGO_COLUMN_GAP_TWIPS;

// A plain inline image of the logo scaled to its placement's box.
const buildLogoImage = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
  placement: keyof typeof LOGO_BOXES,
): InstanceType<typeof import("docx").ImageRun> =>
  new docxModule.ImageRun({
    data: logo.data,
    type: logo.type,
    transformation: computeLogoDisplaySize(logo, placement),
  });

// A "banner" letterhead is the organization's own letterhead graphic: scaled
// (up or down) to the full content width, keeping its aspect ratio, but never
// taller than BANNER_MAX_HEIGHT_PX so an odd image can't swallow the page.
const BANNER_MAX_HEIGHT_PX = 240;

const computeBannerDisplaySize = (logo: DocxLetterheadLogo): LogoBox => {
  const contentWidthPx = Math.floor(CONTENT_WIDTH_TWIPS / TWIPS_PER_PX);
  if (logo.height <= 0 || logo.width <= 0) {
    return { width: contentWidthPx, height: BANNER_MAX_HEIGHT_PX / 2 };
  }
  const scale = Math.min(
    contentWidthPx / logo.width,
    BANNER_MAX_HEIGHT_PX / logo.height,
  );
  return {
    width: Math.round(logo.width * scale),
    height: Math.round(logo.height * scale),
  };
};

// Table borders that draw only the rule under the letterhead.
const letterheadTableBorders = (
  docxModule: typeof import("docx"),
  ruleColor = "000000",
) => {
  const { BorderStyle } = docxModule;
  const none = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  return {
    top: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
    bottom: { style: BorderStyle.SINGLE, size: RULE_SIZE, color: ruleColor },
  };
};

// The banner graphic in a 1×1 borderless table whose bottom border is the
// rule under the letterhead (a paragraph border isn't drawn by Pages).
const buildBannerTable = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
  ruleColor?: string,
): InstanceType<typeof import("docx").Table> => {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    ImageRun,
    AlignmentType,
    WidthType,
    TableLayoutType,
  } = docxModule;
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_TWIPS],
    layout: TableLayoutType.FIXED,
    borders: letterheadTableBorders(docxModule, ruleColor),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            margins: { top: 0, bottom: 100, left: 0, right: 0 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 240 },
                children: [
                  new ImageRun({
                    data: logo.data,
                    type: logo.type,
                    transformation: computeBannerDisplaySize(logo),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

// "#1f5f3a" → "1F5F3A" (docx colors are bare hex); anything else → undefined.
const toDocxColor = (color?: string | null): string | undefined =>
  color && /^#[0-9a-fA-F]{6}$/.test(color)
    ? color.slice(1).toUpperCase()
    : undefined;

// A centered paragraph holding the logo above a "centered" letterhead.
const buildCenteredLogoParagraph = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
): InstanceType<typeof import("docx").Paragraph> => {
  const { Paragraph, AlignmentType } = docxModule;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80, line: 240 },
    children: [buildLogoImage(logo, docxModule, "above")],
  });
};

// An empty paragraph exactly `height` twips tall: the gap below a table (Word
// and Pages put the next paragraph flush against a table).
const buildSpacer = (
  docxModule: typeof import("docx"),
  height: number,
): InstanceType<typeof import("docx").Paragraph> => {
  const { Paragraph, LineRuleType } = docxModule;
  return new Paragraph({
    spacing: {
      before: 0,
      after: 0,
      line: height,
      lineRule: LineRuleType.EXACT,
    },
  });
};

// The letterhead renders smaller than the 11pt body (9.5pt, matching the PDF).
const HEADER_FONT_HALFPT = 19;

// Letterhead cell padding (twips): no left inset and an 8pt gutter before the
// next column; the last column has no right inset, so a right-aligned address
// sits flush with the right margin like the `{right}` lines below it. The
// bottom inset keeps the text clear of the rule below the letterhead.
const HEADER_CELL_MARGINS = { top: 20, bottom: 100, left: 0, right: 160 };
const LAST_HEADER_CELL_MARGINS = { ...HEADER_CELL_MARGINS, right: 0 };
// Grid letterhead spacing, as in the PDF export: cells flush with the top,
// the rule 6pt below the row (the cells' bottom inset) and 6pt above the body
// (the spacer after the table). Left and right insets are each cell's share
// of the gutter it keeps from a touching neighbour (zero on the outer edges
// and next to a gap).
const GRID_RULE_GAP_TWIPS = 120;
const GRID_CELL_MARGINS = {
  top: 0,
  bottom: GRID_RULE_GAP_TWIPS,
  left: 0,
  right: 0,
};
const GRID_LETTERHEAD_GAP_TWIPS = 120;
// Single-spaced letterhead lines with no space before or after.
const LETTERHEAD_LINE_SPACING = { before: 0, after: 0, line: 240 };
// Gap (twips) between stacked letterhead lines in one column.
const HEADER_LINE_GAP_TWIPS = 40;
// Width (twips) of a table column that has no content at all.
const EMPTY_COLUMN_TWIPS = 360;

// The letterhead's logo column ("margin"/"inline" placement): the logo inline
// at its top left, with a gutter before the text. `margins` are the insets of
// the letterhead's other cells (its right inset is the gutter).
const buildLogoColumnCell = (
  logo: DocxLetterheadLogo,
  docxModule: typeof import("docx"),
  placement: "margin" | "inline",
  margins: { top: number; bottom: number } = HEADER_CELL_MARGINS,
): InstanceType<typeof import("docx").TableCell> => {
  const { TableCell, Paragraph, VerticalAlign, WidthType } = docxModule;
  return new TableCell({
    verticalAlign: VerticalAlign.TOP,
    width: { size: logoColumnTwips(logo, placement), type: WidthType.DXA },
    margins: {
      top: margins.top,
      bottom: margins.bottom,
      left: 0,
      right: LOGO_COLUMN_GAP_TWIPS,
    },
    children: [
      new Paragraph({
        spacing: LETTERHEAD_LINE_SPACING,
        children: [buildLogoImage(logo, docxModule, placement)],
      }),
    ],
  });
};

// Body tables use the body run size and Word's default cell margins (108
// twips on the left and on the right), since their cells set none of their
// own.
const BODY_CELL_PADDING_TWIPS = 108 * 2;

type TableSizing = {
  // Width (twips) the columns share; defaults to the full content width.
  totalWidth?: number;
  // Run size in half-points the cell text renders at.
  fontHalfPt: number;
  // Horizontal cell padding (left + right margins) in twips.
  padding: number;
  // Width (twips) of a column with no content at all.
  emptyWidth: number;
};

// Sizes table columns to their content (see computeColumnWidths), estimating
// text width at the table's font size (1pt = 20 twips, so one em is
// fontHalfPt × 10 twips). A letterhead's text columns share whatever its logo
// column leaves of the content width. An explicit grid matters for body tables too: without one docx writes 100-twip
// columns that renderers other than Word (Pages, Google Docs) honor.
const computeTableColumnWidths = (
  rows: string[][],
  {
    totalWidth = CONTENT_WIDTH_TWIPS,
    fontHalfPt,
    padding,
    emptyWidth,
  }: TableSizing,
): number[] => {
  const widths = computeColumnWidths({
    rows,
    totalWidth,
    measure: (text) => estimateTextWidthEm(text) * fontHalfPt * 10,
    padding,
    emptyWidth,
  }).map(Math.round);
  // OOXML widths are whole twips; the last column absorbs the rounding.
  const rounded = widths.reduce((total, width) => total + width, 0);
  widths[widths.length - 1] += totalWidth - rounded;
  return widths;
};

type RunOptions = {
  // Force bold (letterhead identity columns).
  forceBold?: boolean;
  // Strip all bold emphasis, keeping italic — body text in these official
  // letters carries no bold (only the letterhead and File Code/Date labels do).
  suppressBold?: boolean;
  // Run size override in half-points (e.g. the smaller letterhead font).
  size?: number;
  // Color (bare hex) of the bold runs — the letterhead's brand color.
  boldColor?: string;
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

  const segments = splitByPlaceholders(text);

  for (const segment of segments) {
    if (segment.isPlaceholder) {
      const commentId = commentCounter.value++;
      comments.push({ id: commentId, description: segment.description! });

      children.push(new CommentRangeStart(commentId));
      const emphasis = segment.emphasis ?? "";
      const runs = parseFormattedRuns(
        `${emphasis}${segment.text}${emphasis}`,
        docxModule,
        opts,
      );
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
  // Canonical emphasis marker ("*", "**" or "***") that directly wrapped the
  // placeholder in the markdown.
  emphasis?: string;
};

// A placeholder, optionally wrapped directly in bold/italic markers
// ("**[INSERT X]**"). The markers are consumed with the token, so they never
// leak into the export as literal asterisks, and re-applied to its text, so a
// bold placeholder (e.g. a letterhead firm name) stays bold. Markers separated
// from the bracket by other text (genuine emphasis) are left untouched.
const createWrappedPlaceholderRegex = (): RegExp =>
  new RegExp(
    `([*_]{1,3})(${PLACEHOLDER_SOURCE})([*_]{1,3})|(${PLACEHOLDER_SOURCE})`,
    "g",
  );

const splitByPlaceholders = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  const regex = createWrappedPlaceholderRegex();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isPlaceholder: false,
      });
    }
    const [, open, wrapped, close, bare] = match;
    // The reviewer note (after "||") becomes the comment body; the anchored
    // text is the placeholder with the note stripped off.
    const { desc, note, visible } = parsePlaceholder(wrapped ?? bare);
    // Mismatched markers ("**[X]*") keep the emphasis both sides agree on.
    const emphasisLevel =
      open && close ? Math.min(open.length, close.length) : 0;
    segments.push({
      text: visible,
      isPlaceholder: true,
      description: note || desc,
      emphasis: "*".repeat(emphasisLevel),
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
  const { forceBold = false, suppressBold = false, size, boldColor } = opts;
  // Marker bold and forced bold both yield to suppression; explicit `false` (not
  // omission) is emitted so it overrides any inherited paragraph/heading style.
  const bold = (value: boolean) => (suppressBold ? false : value);
  const colorFor = (value: boolean) =>
    boldColor && bold(value) ? boldColor : undefined;

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
          color: colorFor(forceBold),
          size,
        }),
      );
    }

    if (inlineMatch[1]) {
      runs.push(
        new TextRun({
          text: inlineMatch[2],
          bold: bold(true),
          color: colorFor(true),
          italics: true,
          size,
        }),
      );
    } else if (inlineMatch[3]) {
      runs.push(
        new TextRun({
          text: inlineMatch[4],
          bold: bold(true),
          color: colorFor(true),
          size,
        }),
      );
    } else if (inlineMatch[5]) {
      runs.push(
        new TextRun({
          text: inlineMatch[6],
          bold: bold(forceBold),
          color: colorFor(forceBold),
          italics: true,
          size,
        }),
      );
    }

    lastIdx = inlineRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(lastIdx),
        bold: bold(forceBold),
        color: colorFor(forceBold),
        size,
      }),
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
const ALIGNED_LINE_REGEX = /^\{(right|center)\}/;
// A markdown thematic break (`---`, `***`, `___`) — dropped, never rendered as
// literal text (the letterhead draws its own separator).
const THEMATIC_BREAK_REGEX = /^\s*([-*_])\1{2,}\s*$/;
// A complimentary close alone in its paragraph, followed by signature space.
const CLOSING_LINE_REGEX = /^(sincerely|sincerely yours|respectfully),?$/i;
const INLINE_EMPHASIS_REGEX =
  /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;

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

const isAlignedLine = (line: string): boolean => ALIGNED_LINE_REGEX.test(line);

// Lines that start their own block (table, rule, aligned line, heading, list
// item) and therefore end a running body paragraph.
const isBlockStart = (line: string): boolean =>
  THEMATIC_BREAK_REGEX.test(line) ||
  TABLE_ROW_REGEX.test(line) ||
  isAlignedLine(line) ||
  HEADING_REGEX.test(line) ||
  BULLET_REGEX.test(line) ||
  NUMBERED_REGEX.test(line);

// A body paragraph: consecutive non-blank lines from `start` up to the next
// blank line or block start. Its single newlines are line breaks, not
// paragraph breaks — an address or signature block stays one tight paragraph.
const collectParagraph = (
  lines: string[],
  start: number,
): { lines: string[]; next: number } => {
  const collected = [lines[start]];
  let next = start + 1;
  while (
    next < lines.length &&
    lines[next].trim() !== "" &&
    !isBlockStart(lines[next])
  ) {
    collected.push(lines[next]);
    next++;
  }
  return { lines: collected, next };
};

// Text that is a single bold span (`**Purpose and Need**`), ignoring
// whitespace around it.
const isBoldOnlyText = (text: string): boolean => {
  const spans: boolean[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_EMPHASIS_REGEX)) {
    if (text.slice(lastIndex, match.index).trim() !== "") {
      spans.push(false);
    }
    spans.push(!!(match[1] || match[3]));
    lastIndex = match.index + match[0].length;
  }
  if (text.slice(lastIndex).trim() !== "") {
    spans.push(false);
  }
  return spans.length === 1 && spans[0];
};

type ParagraphKind = "body" | "section-heading" | "closing";

// A one-line paragraph that is entirely bold is a section heading; a lone
// "Sincerely," is a complimentary close.
const classifyParagraph = (paragraphLines: string[]): ParagraphKind => {
  if (paragraphLines.length !== 1) {
    return "body";
  }
  const text = paragraphLines[0].trim();
  if (isBoldOnlyText(text)) {
    return "section-heading";
  }
  if (CLOSING_LINE_REGEX.test(text)) {
    return "closing";
  }
  return "body";
};

// Consecutive `{right}`/`{center}` lines (blank lines between them don't
// break the run) sit tight; only the last one of a run gets paragraph spacing.
const isFollowedByAlignedLine = (lines: string[], index: number): boolean => {
  let next = index + 1;
  while (next < lines.length && lines[next].trim() === "") {
    next++;
  }
  return next < lines.length && isAlignedLine(lines[next]);
};

// Spacing of a body-text paragraph with the given space after (twips). Set on
// every paragraph, not only in the styles, so apps that ignore styles agree.
const bodySpacing = (after: number) => ({
  before: 0,
  after,
  line: BODY_LINE_TWIPS,
});

// Explicitly zero indents: a paragraph never inherits a list's hanging indent.
const NO_INDENT = { left: 0, right: 0, firstLine: 0 };

type LetterheadOptions = {
  // Logo drawn in the letterhead's own first column ("margin"/"inline").
  logo?: DocxLetterheadLogo;
  logoPlacement: "margin" | "inline";
  // Brand color (bare hex) of the bold runs and the rule under the letterhead.
  accentColor?: string;
};

// Builds a body table, or — given `letterhead` — the borderless letterhead
// table whose bottom border is the rule separating it from the body.
const buildTable = (
  rows: string[][],
  alignments: ColumnAlignment[],
  commentCounter: { value: number },
  comments: CommentEntry[],
  docxModule: typeof import("docx"),
  letterhead?: LetterheadOptions,
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
  const isHeader = !!letterhead;
  const logo = letterhead?.logo;

  // Body tables get a visible 0.5pt grid (size is in eighths of a point).
  // Cell-level borders would override table-level ones, so no cell sets any.
  const bodyBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const borders = letterhead
    ? letterheadTableBorders(docxModule, letterhead.accentColor)
    : {
        top: bodyBorder,
        bottom: bodyBorder,
        left: bodyBorder,
        right: bodyBorder,
        insideHorizontal: bodyBorder,
        insideVertical: bodyBorder,
      };

  // The letterhead logo sits inline in an extra first column spanning every
  // row; the text columns share the rest of the content width.
  const logoColumn =
    letterhead && logo ? logoColumnTwips(logo, letterhead.logoPlacement) : 0;

  const colCount = rows[0]?.length ?? 0;
  const colWidths = computeTableColumnWidths(
    rows,
    isHeader
      ? {
          totalWidth: CONTENT_WIDTH_TWIPS - logoColumn,
          fontHalfPt: HEADER_FONT_HALFPT,
          padding: HEADER_CELL_MARGINS.left + HEADER_CELL_MARGINS.right,
          emptyWidth: EMPTY_COLUMN_TWIPS,
        }
      : {
          fontHalfPt: BODY_FONT_HALFPT,
          padding: BODY_CELL_PADDING_TWIPS,
          emptyWidth: EMPTY_COLUMN_TWIPS,
        },
  );
  // Separator-row markers mean the letterhead layout was chosen to mirror the
  // reference document; without them it's a legacy agency letterhead.
  const isExplicitLayout = hasExplicitAlignment(alignments);

  const markerAlignment = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };

  const columnAlignment = (colIndex: number) => {
    const marker = alignments[colIndex];
    if (marker) {
      return markerAlignment[marker];
    }
    if (!isHeader) {
      return undefined;
    }
    if (isExplicitLayout) {
      return AlignmentType.LEFT;
    }
    // Legacy letterhead: the address/contact column (last) hugs the right edge.
    return colIndex === colCount - 1 ? AlignmentType.RIGHT : undefined;
  };

  // Letterhead rows are single-spaced with no trailing gap; body table cells
  // get a little air inside the grid.
  const cellSpacing = isHeader
    ? LETTERHEAD_LINE_SPACING
    : { before: 40, after: 40, line: 240 };

  const cellRuns = (text: string, colIndex: number, rowIndex: number) =>
    parseInlineFormatting(text, commentCounter, comments, docxModule, {
      // Legacy letterheads bold every agency identity column; the
      // address/contact column (last) stays regular weight. Explicit layouts
      // take bold from the markdown only. Body tables bold their header row.
      forceBold: isHeader
        ? !isExplicitLayout && colIndex !== colCount - 1
        : rowIndex === 0,
      // The letterhead renders slightly smaller than the body.
      size: isHeader ? HEADER_FONT_HALFPT : undefined,
      boldColor: letterhead?.accentColor,
    });

  // Undefined for surplus cells of a row longer than the first: they have no
  // grid column, and docx throws on a width without a size.
  const cellWidth = (colIndex: number) =>
    colWidths[colIndex] === undefined
      ? undefined
      : { size: colWidths[colIndex], type: WidthType.DXA };

  if (letterhead) {
    // The letterhead is ONE row: each column's non-empty lines stack in a
    // single cell. With a row per line, a wrapped name or a tall logo stretches
    // a row and pulls the contact lines apart (Pages spreads extra height over
    // every row of a merged cell). Surplus cells join the last column.
    const columns = Array.from({ length: colCount }, (_, colIndex) =>
      rows
        .flatMap((cells) =>
          colIndex === colCount - 1
            ? cells.slice(colIndex)
            : [cells[colIndex] ?? ""],
        )
        .filter((text) => text.trim() !== ""),
    );
    const textCells = columns.map(
      (columnLines, colIndex) =>
        new TableCell({
          verticalAlign: VerticalAlign.TOP,
          width: cellWidth(colIndex),
          margins:
            colIndex === colCount - 1
              ? LAST_HEADER_CELL_MARGINS
              : HEADER_CELL_MARGINS,
          children: (columnLines.length > 0 ? columnLines : [""]).map(
            (text, lineIndex) =>
              new Paragraph({
                children: cellRuns(text, colIndex, lineIndex),
                alignment: columnAlignment(colIndex),
                spacing: {
                  ...cellSpacing,
                  after:
                    lineIndex < columnLines.length - 1
                      ? HEADER_LINE_GAP_TWIPS
                      : 0,
                },
              }),
          ),
        }),
    );
    // The logo sits inline in its own first column.
    const logoCells = logo
      ? [buildLogoColumnCell(logo, docxModule, letterhead.logoPlacement)]
      : [];
    return new Table({
      rows: [new TableRow({ children: [...logoCells, ...textCells] })],
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      borders,
      columnWidths: logo ? [logoColumn, ...colWidths] : colWidths,
      layout: TableLayoutType.FIXED,
    });
  }

  const tableRows = rows.map(
    (cells, rowIndex) =>
      new TableRow({
        children: cells.map(
          (cellText, colIndex) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: cellRuns(cellText, colIndex, rowIndex),
                  alignment: columnAlignment(colIndex),
                  spacing: cellSpacing,
                }),
              ],
              width: cellWidth(colIndex),
            }),
        ),
      }),
  );

  return new Table({
    rows: tableRows,
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders,
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
  });
};

// A logo's image fitted (aspect kept) into its box (px), like the PDF's
// `fit`; the box itself when the image's size is unknown.
const fitLogoInBox = (logo: DocxLetterheadLogo, box: LogoBox): LogoBox => {
  if (logo.width <= 0 || logo.height <= 0) {
    return box;
  }
  const scale = Math.min(box.width / logo.width, box.height / logo.height);
  return { width: logo.width * scale, height: logo.height * scale };
};

/**
 * A grid letterhead as ONE borderless table row: one column per
 * `layoutGridLetterhead` segment (cell or gap) at its fraction of the grid's
 * width, in a fixed layout so Word, Pages and LibreOffice keep it. A text
 * cell stacks its lines (base size × `GRID_LINE_SCALE`, bold lines in the
 * grid's colour) and Word wraps them inside the cell; the base size is
 * `gridBaseFontRatio(grid)` of the grid's width (the reference's own size
 * when the grid has one), as in the PDF and the preview, so lines wrap at
 * the same words. A logo cell holds `logos[cell.index]`
 * fitted into its `gridLogoSize` box, top-left, or nothing when it is null.
 * The row is as tall as its tallest cell; a cell (text or logo) sits at its
 * top, or in its middle or at its bottom by its `valign` — the cell's own
 * vertical alignment, which Word applies between the cell's margins, so it
 * moves as far as the PDF's `gridCellOffset` (every cell's lines have no
 * space before or after to tip it). The table's bottom border is the rule.
 *
 * `marginLogo` (a grid without logo cells: the office → org logo) gets its
 * own first column INSIDE the content width, as on every other letterhead,
 * and the grid spans what it leaves (≈ 88% of the width; its text scales
 * with it, so it wraps as in the PDF). The PDF and the preview hang that
 * logo in the page margin instead. Pulling the column into the margin with a
 * negative table indent was tried: LibreOffice honours it, but the rule (the
 * table's bottom border) then runs under the logo into the margin, and a
 * renderer that clamps the indent to 0 would push the whole letterhead into
 * the right margin.
 */
const buildGridLetterheadTable = (
  { grid, logos }: DocxGridLetterhead,
  docxModule: typeof import("docx"),
  marginLogo?: DocxLetterheadLogo,
): InstanceType<typeof import("docx").Table> => {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    TextRun,
    ImageRun,
    AlignmentType,
    LineRuleType,
    TableLayoutType,
    VerticalAlign,
    WidthType,
  } = docxModule;
  const color = toDocxColor(grid.color);
  const logoColumn = marginLogo ? logoColumnTwips(marginLogo, "margin") : 0;
  const gridWidth = CONTENT_WIDTH_TWIPS - logoColumn;
  const toTwips = (fraction: number) => Math.round(fraction * gridWidth);
  // Twips → points (÷ 20) → half-points (× 2); each line rounds its own size.
  const baseHalfPt = (gridBaseFontRatio(grid) * gridWidth) / 10;

  // `layoutGridLetterhead` drops sliver cells, but a gap can still be float
  // noise between two cells: one that rounds to 0 twips gets no column.
  const segments = layoutGridLetterhead(grid).filter(
    (segment) => toTwips(segment.width) > 0,
  );
  const widths = segments.map((segment) => toTwips(segment.width));
  // OOXML widths are whole twips; the last column absorbs the rounding.
  widths[widths.length - 1] +=
    gridWidth - widths.reduce((total, width) => total + width, 0);

  const alignments = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };
  const verticalAlignments = {
    top: VerticalAlign.TOP,
    middle: VerticalAlign.CENTER,
    bottom: VerticalAlign.BOTTOM,
  };
  // What a cell with nothing to draw holds (a cell needs a paragraph): one
  // exactly-1pt line, so it never adds to the row's height.
  const emptyParagraph = () =>
    new Paragraph({
      spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
    });

  const contentOf = (segment: GridSegment<PublicGridLetterheadCell>) => {
    if (segment.kind === "gap") {
      return [emptyParagraph()];
    }
    const { cell } = segment;
    if (cell.kind === "logo") {
      const logo = logos[cell.index];
      if (!logo) {
        return [emptyParagraph()];
      }
      // Fractions of the width → px, the unit of ImageRun (96 dpi).
      const box = gridLogoSize(cell, segment.contentWidth);
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: LETTERHEAD_LINE_SPACING,
          children: [
            new ImageRun({
              data: logo.data,
              type: logo.type,
              transformation: fitLogoInBox(logo, {
                width: (box.width * gridWidth) / TWIPS_PER_PX,
                height: (box.height * gridWidth) / TWIPS_PER_PX,
              }),
            }),
          ],
        }),
      ];
    }
    const lines = cell.lines.flatMap((line) => {
      const text = cleanGridLineText(line.text);
      if (!text) {
        return [];
      }
      return [
        new Paragraph({
          alignment: alignments[cell.align],
          spacing: LETTERHEAD_LINE_SPACING,
          children: [
            new TextRun({
              text,
              bold: line.bold,
              color: line.bold ? color : undefined,
              size: Math.round(baseHalfPt * GRID_LINE_SCALE[line.size]),
            }),
          ],
        }),
      ];
    });
    return lines.length > 0 ? lines : [emptyParagraph()];
  };

  const cells = segments.map(
    (segment, index) =>
      new TableCell({
        // A gap has nothing to place.
        verticalAlign:
          segment.kind === "cell"
            ? verticalAlignments[segment.cell.valign ?? "top"]
            : VerticalAlign.TOP,
        width: { size: widths[index], type: WidthType.DXA },
        // A cell's gutters are inside its segment: its left and right margins.
        margins:
          segment.kind === "cell"
            ? {
                ...GRID_CELL_MARGINS,
                left: toTwips(segment.contentStart - segment.start),
                right: toTwips(
                  segment.start +
                    segment.width -
                    segment.contentStart -
                    segment.contentWidth,
                ),
              }
            : GRID_CELL_MARGINS,
        children: contentOf(segment),
      }),
  );

  return new Table({
    rows: [
      new TableRow({
        children: marginLogo
          ? [
              buildLogoColumnCell(
                marginLogo,
                docxModule,
                "margin",
                GRID_CELL_MARGINS,
              ),
              ...cells,
            ]
          : cells,
      }),
    ],
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: letterheadTableBorders(docxModule, color),
    columnWidths: marginLogo ? [logoColumn, ...widths] : widths,
    layout: TableLayoutType.FIXED,
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
        spacing: { before: 0, after: 0, line: 240 },
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
        spacing: { before: 0, after: 0, line: 240 },
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

const FONT = "Times New Roman";

// The default paragraph, character, table and numbering styles, marked
// w:default="1". docx never writes default styles, and without a default
// paragraph style Apple Pages ignores every paragraph's direct formatting
// (alignment, spacing) and carries the previous paragraph's style over to the
// next — the cause of the missing paragraph gaps, the left-aligned `{right}`
// lines and the list hanging indent leaking into body text. docx merges these
// with its own (non-default) styles and the docDefaults below.
const DEFAULT_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="${PARAGRAPH_AFTER_TWIPS}" w:line="${BODY_LINE_TWIPS}" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/></w:pPr><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="${BODY_FONT_HALFPT}"/><w:szCs w:val="${BODY_FONT_HALFPT}"/></w:rPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
</w:styles>`;

// Heading style N: bold black body font at the level's size, with section
// heading spacing (the Word defaults are blue and unbolded).
const headingStyle = (level: number) => ({
  basedOn: "Normal",
  next: "Normal",
  quickFormat: true,
  run: {
    font: FONT,
    bold: true,
    color: "000000",
    size: HEADING_SIZES_HALFPT[level - 1],
  },
  paragraph: {
    keepNext: true,
    spacing: {
      before: HEADING_BEFORE_TWIPS,
      after: HEADING_AFTER_TWIPS,
      line: BODY_LINE_TWIPS,
    },
  },
});

export const generateDocxFromMarkdown = async (
  content: string,
  title: string,
  // The letterhead logo; with a grid letterhead, the margin logo of a grid
  // without logo cells (ignored when the grid has its own).
  logo?: DocxLetterheadLogo,
  footer?: DocxDocumentFooter,
  logoPlacement: LetterheadLogoPlacement = "margin",
  // The applied letterhead's brand color ("#rrggbb"): tints the rule under the
  // letterhead and its bold lines.
  letterheadColor?: string | null,
  { gridLetterhead }: DocxExportOptions = {},
): Promise<Blob> => {
  const docx = await import("docx");
  const { Document, Paragraph, TextRun, Packer, HeadingLevel, AlignmentType } =
    docx;

  const hasFooter = !!(footer && (footer.text || footer.note || footer.logo));
  // A document is "branded" when it carries a letterhead logo, a grid
  // letterhead or a footer. Only branded documents get page-number chrome;
  // plain exports keep their layout.
  const isBranded = !!logo || !!gridLetterhead || hasFooter;

  // Strip "|| note" from placeholders inside table rows before anything else —
  // their pipes would shift parseTableRow's cell split. Covers documents stored
  // before the server-side sanitizer existed.
  const normalizedContent = stripPlaceholderNotesInTableRows(
    decodeHtmlEntities(content),
  )
    .replace(/\\([[\]()])/g, "$1")
    .replace(/(?<=.) *\{(right|center)\}/g, "\n{$1}");

  const comments: CommentEntry[] = [];
  const commentCounter = { value: 0 };
  const paragraphs: FileChild[] = [];
  const accentColor = toDocxColor(letterheadColor);

  const inline = (text: string, opts?: RunOptions) =>
    parseInlineFormatting(text, commentCounter, comments, docx, opts);

  // A body paragraph whose lines are joined by line breaks (w:br).
  const buildBodyParagraph = (
    paragraphLines: string[],
    spacingAfter: number,
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType],
  ) =>
    new Paragraph({
      alignment: alignment ?? AlignmentType.LEFT,
      spacing: bodySpacing(spacingAfter),
      indent: NO_INDENT,
      children: paragraphLines.flatMap((text, index) => [
        ...(index > 0 ? [new TextRun({ break: 1 })] : []),
        ...inline(text.trimEnd()),
      ]),
    });

  // A section heading: a markdown heading (its level's size and Word heading
  // style) or a bold-only paragraph (body size).
  const buildSectionHeading = (text: string, level?: number) =>
    new Paragraph({
      heading: level
        ? HeadingLevel[HEADING_LEVELS[level - 1] as keyof typeof HeadingLevel]
        : undefined,
      keepNext: true,
      spacing: {
        before: HEADING_BEFORE_TWIPS,
        after: HEADING_AFTER_TWIPS,
        line: BODY_LINE_TWIPS,
      },
      indent: NO_INDENT,
      children: inline(text, {
        forceBold: true,
        size: level ? HEADING_SIZES_HALFPT[level - 1] : undefined,
      }),
    });

  // A banner letterhead is the image itself, and a grid letterhead is drawn
  // from its structure (the content carries no letterhead table then), both
  // above the content; the document's first table is then ordinary body
  // content.
  const isBanner = logoPlacement === "banner";
  if (gridLetterhead) {
    const hasLogoCells = gridLogoCells(gridLetterhead.grid).length > 0;
    paragraphs.push(
      buildGridLetterheadTable(
        gridLetterhead,
        docx,
        hasLogoCells ? undefined : logo,
      ),
      buildSpacer(docx, GRID_LETTERHEAD_GAP_TWIPS),
    );
  } else if (isBanner && logo) {
    paragraphs.push(
      buildBannerTable(logo, docx, accentColor),
      buildSpacer(docx, LETTERHEAD_GAP_TWIPS),
    );
  }
  let isFirstTable = !isBanner && !gridLetterhead;

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
      // Per-column alignment from the separator row (empty when it's missing).
      let alignments: ColumnAlignment[] = [];
      while (i < lines.length && TABLE_ROW_REGEX.test(lines[i])) {
        if (TABLE_SEPARATOR_REGEX.test(lines[i])) {
          alignments = parseTableAlignments(lines[i]);
        } else {
          tableRows.push(parseTableRow(lines[i]));
        }
        i++;
      }
      if (tableRows.length > 0) {
        // The first table is the letterhead: its logo goes centered above it
        // ("above") or in its own first column ("margin"/"inline"), and its
        // bottom border is the rule separating it from the body.
        const isLetterhead = isFirstTable;
        if (isLetterhead && logo && logoPlacement === "above") {
          paragraphs.push(buildCenteredLogoParagraph(logo, docx));
        }
        paragraphs.push(
          buildTable(
            tableRows,
            alignments,
            commentCounter,
            comments,
            docx,
            isLetterhead
              ? {
                  logo: logoPlacement === "above" ? undefined : logo,
                  logoPlacement:
                    logoPlacement === "inline" ? "inline" : "margin",
                  accentColor,
                }
              : undefined,
          ),
          buildSpacer(
            docx,
            isLetterhead ? LETTERHEAD_GAP_TWIPS : TABLE_GAP_TWIPS,
          ),
        );
        isFirstTable = false;
      }
      continue;
    }

    // Right-aligned or centered line: {right}text / {center}text
    const alignedMatch = line.match(ALIGNED_LINE_REGEX);
    if (alignedMatch) {
      paragraphs.push(
        buildBodyParagraph(
          [line.slice(alignedMatch[0].length)],
          isFollowedByAlignedLine(lines, i) ? 0 : PARAGRAPH_AFTER_TWIPS,
          alignedMatch[1] === "center"
            ? AlignmentType.CENTER
            : AlignmentType.RIGHT,
        ),
      );
      i++;
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      paragraphs.push(
        buildSectionHeading(headingMatch[2].trim(), headingMatch[1].length),
      );
      i++;
      continue;
    }

    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: bodySpacing(LIST_ITEM_AFTER_TWIPS),
          children: inline(bulletMatch[1], { suppressBold: true }),
        }),
      );
      i++;
      continue;
    }

    const numberedMatch = line.match(NUMBERED_REGEX);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: "default-numbering", level: 0 },
          spacing: bodySpacing(LIST_ITEM_AFTER_TWIPS),
          children: inline(numberedMatch[1], { suppressBold: true }),
        }),
      );
      i++;
      continue;
    }

    // Body paragraph (single newlines inside it are line breaks), a bold-only
    // section heading, or a complimentary close followed by signature space.
    const paragraph = collectParagraph(lines, i);
    const kind = classifyParagraph(paragraph.lines);
    paragraphs.push(
      kind === "section-heading"
        ? buildSectionHeading(paragraph.lines[0].trim())
        : buildBodyParagraph(
            paragraph.lines,
            kind === "closing" ? CLOSING_AFTER_TWIPS : PARAGRAPH_AFTER_TWIPS,
          ),
    );
    i = paragraph.next;
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
    externalStyles: DEFAULT_STYLES_XML,
    // Serif body font to match standard agency letterhead documents. The
    // document defaults repeat the Normal style for apps that ignore styles.
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_FONT_HALFPT },
          paragraph: {
            spacing: bodySpacing(PARAGRAPH_AFTER_TWIPS),
            indent: NO_INDENT,
          },
        },
        heading1: headingStyle(1),
        heading2: headingStyle(2),
        heading3: headingStyle(3),
        heading4: headingStyle(4),
        heading5: headingStyle(5),
        heading6: headingStyle(6),
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
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
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
