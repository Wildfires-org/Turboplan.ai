// pdfkit's default entry loads its built-in AFM font metrics from disk via
// `__dirname`, which doesn't exist on Cloudflare Workers (the deploy target for
// apps/server) and throws "ReferenceError: __dirname is not defined". The
// standalone bundle embeds the font data inline (virtual filesystem), so it
// runs without any filesystem access. The explicit ".js" extension is required
// by Node ESM (apps/server's built `node dist/local.js`); the bare specifier
// only resolves under Bun. @types/pdfkit declares the extensionless subpath, so
// the ".js" form is aliased in pdfkit-standalone.d.ts to preserve types.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

import {
  type ColumnAlignment,
  computeColumnWidths,
  hasExplicitAlignment,
  parseTableAlignments,
} from "./letterhead-layout";

// Generates a PDF that mirrors the DOCX export (markdown-to-docx.ts) so signed
// documents look the same as the downloadable Word version. Uses the same
// line-based markdown dialect: tables (a borderless letterhead, gridded body
// tables), `{right}` right-aligned and `{center}` centered paragraphs,
// headings, bullet/numbered lists, and inline bold/italic. Standard markdown
// libraries (remark-pdf) don't understand this dialect and mis-render
// `{right}`, tables, and `---` separators — hence the hand-rolled parser.

const PAGE_MARGIN = 50;
const BODY_FONT_SIZE = 11;
// The letterhead/header table renders ~1.5pt smaller than the body, matching the
// reference agency letterhead.
const HEADER_FONT_SIZE = 9.5;
const PARAGRAPH_GAP = 6;
const CELL_PADDING = 2;
// Body table cells sit inside a visible grid, so their text gets more room
// from the lines than the invisible letterhead's.
const BODY_CELL_PADDING = 4;
// Body table grid line width (points), matching the DOCX 0.5pt cell borders.
const TABLE_BORDER_WIDTH = 0.5;
// Letterhead columns sit flush with the content edges and are separated by
// this gutter (points), matching the DOCX letterhead cell margins.
const HEADER_COLUMN_GAP = 8;
// Width (points) of a table column that has no content at all.
const EMPTY_COLUMN_WIDTH = 18;
// Slack (points) when wrapping manually laid-out text, so float noise between
// measuring a whole line and its fragments never pushes a word onto a new line.
const WRAP_TOLERANCE = 0.5;

// Letterhead logo box, placed in the LEFT PAGE MARGIN (top-left), so the
// letterhead text keeps the full content width — mirroring a standard agency
// letter where the agency mark sits in the margin. `fit` preserves aspect ratio
// inside this box; the width is kept small enough to fit within PAGE_MARGIN.
const LOGO_W = 44;
const LOGO_H = 56;
// Gap (points) between the margin logo and the letterhead text, which starts
// flush at the content margin (mirrors LOGO_GAP_PX in the DOCX export).
const LOGO_GAP = 4;

// An org/office letterhead logo. PDFKit's `doc.image()` only accepts PNG/JPEG
// buffers; the caller guarantees png/jpeg, but the renderer still wraps the call
// in try/catch so a bad logo can never break the whole PDF.
export type LetterheadLogo = { data: Uint8Array; contentType: string };

// An org/office document footer rendered in the bottom margin of every page:
// a centered tagline, a right-aligned note, and a small left logo. All optional.
export type DocumentFooter = {
  text?: string | null;
  note?: string | null;
  logo?: LetterheadLogo | null;
};

// Footer/page-number layout (points). The footer sits inside the bottom margin
// band (below the body); the page number sits in the top margin band.
const FOOTER_FONT_SIZE = 8.5;
const FOOTER_LOGO_H = 22;
const FOOTER_LOGO_W = 22;
const FOOTER_BASELINE_FROM_BOTTOM = 30;
const PAGE_NUMBER_FONT_SIZE = 10;
const PAGE_NUMBER_FROM_TOP = 25;

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const BULLET_REGEX = /^[\s]*[-*]\s+(.+)$/;
const NUMBERED_REGEX = /^[\s]*\d+\.\s+(.+)$/;
const TABLE_ROW_REGEX = /^\|(.+)\|$/;
const TABLE_SEPARATOR_REGEX = /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/;
const ALIGNED_LINE_REGEX = /^\{(right|center)\}/;

// Heading font sizes by markdown level (1-6).
const HEADING_SIZES = [20, 15, 13, 12, 11, 11];

type Run = { text: string; bold: boolean; italic: boolean };
type TextAlign = "left" | "center" | "right";

// Manually wrapped text: a word is one or more fragments (runs with differing
// fonts, e.g. "**Phone**:") that must stay together on a line.
type Fragment = { text: string; font: string; width: number };
type Word = { fragments: Fragment[]; width: number; spaceBefore: number };
type Line = { words: Word[]; width: number };

// Serif fonts to match standard agency letterhead documents (mirrors the DOCX
// export's Times New Roman default).
const fontFor = (bold: boolean, italic: boolean): string => {
  if (bold && italic) {
    return "Times-BoldItalic";
  }
  if (bold) {
    return "Times-Bold";
  }
  if (italic) {
    return "Times-Italic";
  }
  return "Times-Roman";
};

// Removes reviewer-guidance notes ("|| ...") from placeholders so they never
// appear in the PDF (the PDF has no comments to host them — they are an
// export-only annotation for the DOCX review workflow). Mirrors the shared
// parser in apps/turboplan/lib/placeholders.ts; duplicated because this package
// can't import app code. Matches both placeholder forms and splits on the FIRST
// "||" via indexOf so a single "|" inside a description doesn't break stripping.
const PLACEHOLDER_REGEX =
  /\[INSERT:\s*[^\]]+\]|\[[A-Z][A-Z0-9 .,()&/_-]{2,}\]/g;

const stripPlaceholderNotes = (text: string): string =>
  text.replace(PLACEHOLDER_REGEX, (token) => {
    const sep = token.indexOf("||");
    if (sep === -1) {
      return token;
    }
    return `${token.slice(0, sep).trimEnd()}]`;
  });

// Splits a line into runs carrying bold/italic state. Mirrors the inline regex
// used by the DOCX generator. `suppressBold` strips bold emphasis (keeping
// italic) — body text in these official letters carries no bold (only the
// letterhead and the File Code/Date labels do).
const parseRuns = (text: string, suppressBold = false): Run[] => {
  const runs: Run[] = [];
  const inlineRegex = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const bold = (value: boolean) => (suppressBold ? false : value);

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      runs.push({
        text: text.slice(lastIdx, match.index),
        bold: false,
        italic: false,
      });
    }
    if (match[1]) {
      runs.push({ text: match[2], bold: bold(true), italic: true });
    } else if (match[3]) {
      runs.push({ text: match[4], bold: bold(true), italic: false });
    } else if (match[5]) {
      runs.push({ text: match[6], bold: false, italic: true });
    }
    lastIdx = inlineRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    runs.push({ text: text.slice(lastIdx), bold: false, italic: false });
  }
  if (runs.length === 0) {
    runs.push({ text: "", bold: false, italic: false });
  }
  return runs;
};

const parseTableRow = (line: string): string[] =>
  line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

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

export const generatePdfFromMarkdown = async (
  markdown: string,
  title: string,
  options?: { logo?: LetterheadLogo; footer?: DocumentFooter },
): Promise<Uint8Array> => {
  // The document content already carries its own letterhead/heading, so don't
  // inject the title as a visible heading — only set it as PDF metadata. Same
  // normalization as the DOCX generator: decode HTML entities (so `&nbsp;` etc.
  // never render literally), unescape brackets/parens and move inline `{right}`
  // and `{center}` markers onto their own line.
  const normalized = decodeHtmlEntities(stripPlaceholderNotes(markdown))
    .replace(/\\([[\]()])/g, "$1")
    .replace(/(?<=.) *\{(right|center)\}/g, "\n{$1}");

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    info: { Title: title },
    // Buffer pages so the footer + page numbers can be stamped onto every page
    // after the body has flowed and the final page count is known.
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve) => doc.on("end", resolve));

  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Greedy word wrap of formatted runs into lines no wider than maxWidth, at
  // the current font size. Lines break only at whitespace; a word wider than
  // maxWidth gets a line of its own.
  const layoutRuns = (runs: Run[], maxWidth: number): Line[] => {
    const words: Word[] = [];
    let spaceBefore = 0;
    let isInWord = false;
    for (const run of runs) {
      const font = fontFor(run.bold, run.italic);
      doc.font(font);
      for (const token of run.text.split(/(\s+)/)) {
        if (token === "") {
          continue;
        }
        if (/^\s/.test(token)) {
          spaceBefore = doc.widthOfString(" ");
          isInWord = false;
          continue;
        }
        const fragment = { text: token, font, width: doc.widthOfString(token) };
        const word = words.at(-1);
        if (isInWord && word) {
          word.fragments.push(fragment);
          word.width += fragment.width;
        } else {
          words.push({
            fragments: [fragment],
            width: fragment.width,
            spaceBefore: words.length > 0 ? spaceBefore : 0,
          });
        }
        isInWord = true;
      }
    }

    const lines: Line[] = [{ words: [], width: 0 }];
    for (const word of words) {
      let line = lines[lines.length - 1];
      const fitsOnLine =
        line.words.length === 0 ||
        line.width + word.spaceBefore + word.width <= maxWidth + WRAP_TOLERANCE;
      if (!fitsOnLine) {
        line = { words: [], width: 0 };
        lines.push(line);
      }
      line.width += (line.words.length > 0 ? word.spaceBefore : 0) + word.width;
      line.words.push(word);
    }
    return lines;
  };

  // Draws one laid-out line inside a box of the given width. PDFKit re-aligns
  // every `continued` fragment independently, so combining `continued` with
  // right/center alignment makes mixed-format runs overlap; positioning each
  // fragment manually keeps them flush.
  const drawLine = (
    line: Line,
    x: number,
    y: number,
    width: number,
    align: TextAlign,
  ) => {
    const freeSpace = width - line.width;
    let fragmentX = x;
    if (align === "right") {
      fragmentX += freeSpace;
    } else if (align === "center") {
      fragmentX += freeSpace / 2;
    }
    line.words.forEach((word, index) => {
      if (index > 0) {
        fragmentX += word.spaceBefore;
      }
      for (const fragment of word.fragments) {
        doc
          .font(fragment.font)
          .text(fragment.text, fragmentX, y, { lineBreak: false });
        fragmentX += fragment.width;
      }
    });
  };

  const writeRuns = (
    runs: Run[],
    options: { size: number; align?: TextAlign; gap: number },
  ) => {
    doc.fontSize(options.size);

    if (options.align === "right" || options.align === "center") {
      const lineHeight = doc.currentLineHeight(true);
      for (const line of layoutRuns(runs, usableWidth)) {
        if (doc.y + lineHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }
        drawLine(
          line,
          doc.page.margins.left,
          doc.y,
          usableWidth,
          options.align,
        );
        doc.y += lineHeight;
      }
    } else {
      runs.forEach((run, index) => {
        doc.font(fontFor(run.bold, run.italic));
        doc.text(run.text, {
          continued: index < runs.length - 1,
          align: options.align,
        });
      });
    }

    // Restore the left margin — a manually positioned fragment (or any stray
    // x) would otherwise narrow the wrap width of every following line.
    doc.x = doc.page.margins.left;
    doc.moveDown(options.gap / options.size);
  };

  // Table text measured with the real font metrics, in bold — the widest face
  // a table uses — so a column is never narrower than its text. Leaves the
  // document in Times-Bold at fontSize.
  const measureTableText =
    (fontSize: number) =>
    (text: string): number => {
      doc.font("Times-Bold").fontSize(fontSize);
      return doc.widthOfString(text);
    };

  const renderTable = (
    rows: string[][],
    alignments: ColumnAlignment[],
    isHeader: boolean,
  ) => {
    const colCount = rows[0]?.length ?? 0;
    if (colCount === 0) {
      return;
    }
    // The letterhead renders slightly smaller than the body.
    const fontSize = isHeader ? HEADER_FONT_SIZE : BODY_FONT_SIZE;
    // Columns are sized to their content, like the DOCX export. Tables always
    // span the full content width — the letterhead logo sits in the page
    // margin.
    const widths = computeColumnWidths({
      rows,
      totalWidth: usableWidth,
      measure: measureTableText(fontSize),
      padding: isHeader ? HEADER_COLUMN_GAP : BODY_CELL_PADDING * 2,
      emptyWidth: EMPTY_COLUMN_WIDTH,
    });
    // Separator-row markers mean the letterhead layout was chosen to mirror the
    // reference document; without them it's a legacy agency letterhead.
    const isExplicitLayout = hasExplicitAlignment(alignments);
    const isLegacyHeader = isHeader && !isExplicitLayout;
    const cellPadding = isHeader ? CELL_PADDING : BODY_CELL_PADDING;

    // Horizontal text insets: letterhead columns sit flush with the content
    // edges with a gutter after every column but the last; body table cells
    // are padded on both sides.
    const insetsFor = (ci: number) =>
      isHeader
        ? { left: 0, right: ci < colCount - 1 ? HEADER_COLUMN_GAP : 0 }
        : { left: cellPadding, right: cellPadding };
    let columnX = doc.page.margins.left;
    const textBoxes = widths.map((width, ci) => {
      const { left, right } = insetsFor(ci);
      const box = { x: columnX + left, width: width - left - right };
      columnX += width;
      return box;
    });

    // Legacy letterhead: the address/contact column (last) hugs the right edge.
    const alignFor = (ci: number): TextAlign =>
      alignments[ci] ??
      (isLegacyHeader && ci === colCount - 1 ? "right" : "left");

    // Legacy letterheads bold every agency identity column but the last
    // (address) and body tables bold their header row; other cells (and
    // explicit letterhead layouts) take bold from the markdown.
    const runsFor = (cellText: string, ri: number, ci: number): Run[] => {
      const runs = parseRuns(cellText);
      const isBold = isHeader ? isLegacyHeader && ci < colCount - 1 : ri === 0;
      return isBold ? runs.map((run) => ({ ...run, bold: true })) : runs;
    };

    // Body tables get a visible grid (the letterhead stays invisible): one
    // rectangle per cell, stroked in its own graphics state so the line style
    // never leaks into later drawing.
    const strokeCellBorders = (rowY: number, rowBoxHeight: number) => {
      doc.save().lineWidth(TABLE_BORDER_WIDTH).strokeColor("#000000");
      let cellX = doc.page.margins.left;
      for (const width of widths) {
        doc.rect(cellX, rowY, width, rowBoxHeight);
        cellX += width;
      }
      doc.stroke().restore();
    };

    // Line height depends on the current face, and measuring left it bold.
    // The letterhead keeps the bold metrics it has always been laid out with;
    // body cells reset to the regular face so their lines match body
    // paragraphs. (Cell text sets its own font per run when drawn.)
    doc.font(isHeader ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
    const lineHeight = doc.currentLineHeight(true);

    for (const [ri, cells] of rows.entries()) {
      const cellLines = cells
        .slice(0, colCount)
        .map((cellText, ci) =>
          layoutRuns(runsFor(cellText, ri, ci), textBoxes[ci].width),
        );
      // Row height from the tallest cell, plus the vertical insets.
      const rowBoxHeight =
        Math.max(...cellLines.map((lines) => lines.length)) * lineHeight +
        cellPadding * 2;

      if (doc.y + rowBoxHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      const rowY = doc.y;
      cellLines.forEach((lines, ci) => {
        lines.forEach((line, li) => {
          drawLine(
            line,
            textBoxes[ci].x,
            rowY + cellPadding + li * lineHeight,
            textBoxes[ci].width,
            alignFor(ci),
          );
        });
      });
      if (!isHeader) {
        strokeCellBorders(rowY, rowBoxHeight);
      }

      doc.x = doc.page.margins.left;
      doc.y = rowY + rowBoxHeight;
    }
    doc.moveDown(PARAGRAPH_GAP / BODY_FONT_SIZE);
  };

  // A full-width horizontal line — drawn as a real stroked line (not a table
  // border) — separating the letterhead from the document body.
  const drawHorizontalRule = () => {
    const y = doc.y;
    doc
      .save()
      .lineWidth(0.75)
      .strokeColor("#000000")
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + usableWidth, y)
      .stroke()
      .restore();
    doc.x = doc.page.margins.left;
    doc.y = y + PARAGRAPH_GAP;
  };

  const lines = normalized.split("\n");
  let i = 0;
  let isFirstTable = true;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Thematic break (`---`, `***`, `___`): a markdown horizontal rule. The
    // letterhead already draws its own separator, so drop these — they should
    // never render as literal "---" text in the body.
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      i++;
      continue;
    }

    // Table: collect consecutive table rows.
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
        const wasHeaderTable = isFirstTable;
        // The logo sits in the left page margin, so the letterhead table always
        // renders at full content width. A bad logo is simply skipped so it can
        // never break the PDF.
        let logoBottom = 0;

        if (wasHeaderTable && options?.logo) {
          const logoTop = doc.y;
          try {
            // PDFKit's standalone bundle ships its own Buffer/fs shims: passing a
            // host Buffer/Uint8Array fails its internal `Buffer.isBuffer` check,
            // falls through to the filename path, and throws
            // "fs.readFileSync is not a function". A base64 data URL is the only
            // input the bundle decodes without touching the filesystem.
            const base64 = Buffer.from(options.logo.data).toString("base64");
            // Place the logo in the left margin: right-aligned in its box so
            // its right edge sits LOGO_GAP before the content margin, extending
            // left into the margin whitespace (clamped to the page edge), so
            // the table keeps the full width.
            const logoLeft = Math.max(
              2,
              doc.page.margins.left - LOGO_W - LOGO_GAP,
            );
            doc.image(
              `data:${options.logo.contentType};base64,${base64}`,
              logoLeft,
              logoTop,
              { fit: [LOGO_W, LOGO_H], align: "right" },
            );
            logoBottom = logoTop + LOGO_H;
            // `doc.image()` advances doc.y past the image; reset to logoTop so
            // the header table starts at the same top edge as the logo.
            doc.y = logoTop;
          } catch (error) {
            // Bad/unsupported image: render the letterhead anyway rather than
            // failing the whole PDF. Logged so the cause isn't silently lost.
            console.error(
              "[pdf-generator] Failed to embed letterhead logo:",
              error,
            );
            logoBottom = 0;
          }
        }

        renderTable(tableRows, alignments, isFirstTable);
        isFirstTable = false;
        if (wasHeaderTable) {
          // Keep the rule and body below a tall logo: drop doc.y to the lower of
          // the header table bottom and the logo bottom.
          if (logoBottom > doc.y) {
            doc.y = logoBottom;
          }
          drawHorizontalRule();
        }
      }
      continue;
    }

    // Right-aligned or centered paragraph: {right}text / {center}text
    const alignedMatch = line.match(ALIGNED_LINE_REGEX);
    if (alignedMatch) {
      writeRuns(parseRuns(line.slice(alignedMatch[0].length)), {
        size: BODY_FONT_SIZE,
        align: alignedMatch[1] === "center" ? "center" : "right",
        gap: PARAGRAPH_GAP,
      });
      i++;
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // Headings are sized but NOT bold — official letters carry no bold body.
      const runs = parseRuns(headingMatch[2].trim(), true);
      writeRuns(runs, {
        size: HEADING_SIZES[level - 1],
        gap: PARAGRAPH_GAP * 1.5,
      });
      i++;
      continue;
    }

    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch) {
      writeRuns(
        [{ text: "•  ", bold: false, italic: false }].concat(
          parseRuns(bulletMatch[1], true),
        ),
        { size: BODY_FONT_SIZE, gap: PARAGRAPH_GAP / 2 },
      );
      i++;
      continue;
    }

    const numberedMatch = line.match(NUMBERED_REGEX);
    if (numberedMatch) {
      writeRuns(parseRuns(line.trim(), true), {
        size: BODY_FONT_SIZE,
        gap: PARAGRAPH_GAP / 2,
      });
      i++;
      continue;
    }

    // Regular body paragraph — no bold.
    writeRuns(parseRuns(line, true), {
      size: BODY_FONT_SIZE,
      gap: PARAGRAPH_GAP,
    });
    i++;
  }

  // Stamp the footer (and page numbers) onto every buffered page, drawn into the
  // bottom/top margin bands so they never overlap the body. Done after layout so
  // the page count is final.
  const footer = options?.footer;
  const hasFooter = !!(footer && (footer.text || footer.note || footer.logo));
  // Page numbers are letterhead chrome — only stamp them (and run the buffered
  // page pass at all) for branded documents, so plain exports keep their layout.
  const isBranded = !!options?.logo || hasFooter;
  const range = doc.bufferedPageRange();
  for (let p = 0; isBranded && p < range.count; p++) {
    doc.switchToPage(range.start + p);
    const pageBottom = doc.page.height;
    const footerY = pageBottom - FOOTER_BASELINE_FROM_BOTTOM;

    // Writing into the top/bottom margin bands would make PDFKit think content
    // overflowed and auto-append blank pages. Zero the vertical margins while
    // stamping so the footer + page number stay on their own page.
    const savedMargins = { ...doc.page.margins };
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;

    if (hasFooter && footer) {
      // Left: footer logo, in the margin band, bottom-aligned with the text.
      if (footer.logo) {
        try {
          const base64 = Buffer.from(footer.logo.data).toString("base64");
          doc.image(
            `data:${footer.logo.contentType};base64,${base64}`,
            doc.page.margins.left,
            footerY - (FOOTER_LOGO_H - FOOTER_FONT_SIZE),
            { fit: [FOOTER_LOGO_W, FOOTER_LOGO_H] },
          );
        } catch (error) {
          console.error("[pdf-generator] Failed to embed footer logo:", error);
        }
      }
      doc.font("Times-Roman").fontSize(FOOTER_FONT_SIZE).fillColor("#000000");
      // Center: tagline.
      if (footer.text) {
        doc.text(footer.text, doc.page.margins.left, footerY, {
          width: usableWidth,
          align: "center",
          lineBreak: false,
        });
      }
      // Right: note (drawn on the same baseline, right-aligned).
      if (footer.note) {
        doc.text(footer.note, doc.page.margins.left, footerY, {
          width: usableWidth,
          align: "right",
          lineBreak: false,
        });
      }
    }

    // Page number in the top margin band, right-aligned. Skipped on page 1 to
    // match standard agency letters.
    if (p > 0) {
      doc
        .font("Times-Roman")
        .fontSize(PAGE_NUMBER_FONT_SIZE)
        .fillColor("#000000");
      doc.text(`${p + 1}`, savedMargins.left, PAGE_NUMBER_FROM_TOP, {
        width: usableWidth,
        align: "right",
        lineBreak: false,
      });
    }

    doc.page.margins.top = savedMargins.top;
    doc.page.margins.bottom = savedMargins.bottom;
  }

  doc.end();
  await finished;
  return new Uint8Array(Buffer.concat(chunks));
};
