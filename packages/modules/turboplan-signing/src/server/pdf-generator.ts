// pdfkit's default entry loads its built-in AFM font metrics from disk via
// `__dirname`, which doesn't exist on Cloudflare Workers (the deploy target for
// apps/server) and throws "ReferenceError: __dirname is not defined". The
// standalone bundle embeds the font data inline (virtual filesystem), so it
// runs without any filesystem access. The explicit ".js" extension is required
// by Node ESM (apps/server's built `node dist/local.js`); the bare specifier
// only resolves under Bun. @types/pdfkit declares the extensionless subpath, so
// the ".js" form is aliased in pdfkit-standalone.d.ts to preserve types.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

// Generates a PDF that mirrors the DOCX export (markdown-to-docx.ts) so signed
// documents look the same as the downloadable Word version. Uses the same
// line-based markdown dialect: borderless tables, `{right}` right-aligned
// paragraphs, headings, bullet/numbered lists, and inline bold/italic. Standard
// markdown libraries (remark-pdf) don't understand this dialect and mis-render
// `{right}`, tables, and `---` separators — hence the hand-rolled parser.

const PAGE_MARGIN = 50;
const BODY_FONT_SIZE = 11;
// The letterhead/header table renders ~1.5pt smaller than the body, matching the
// reference agency letterhead.
const HEADER_FONT_SIZE = 9.5;
const PARAGRAPH_GAP = 6;
const CELL_PADDING = 2;

// Letterhead logo box, placed in the LEFT PAGE MARGIN (top-left), so the
// letterhead text keeps the full content width — mirroring a standard agency
// letter where the agency mark sits in the margin. `fit` preserves aspect ratio
// inside this box; the width is kept small enough to fit within PAGE_MARGIN.
const LOGO_W = 44;
const LOGO_H = 56;

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

// Heading font sizes by markdown level (1-6).
const HEADING_SIZES = [20, 15, 13, 12, 11, 11];

// Header letterhead column proportions, matched to the DOCX fixed widths
// [2060, 1215, 2620, 3465] (total 9360 twips).
const HEADER_COL_FRACTIONS = [0.2201, 0.1298, 0.2799, 0.3702];

type Run = { text: string; bold: boolean; italic: boolean };

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
  // markers onto their own line.
  const normalized = decodeHtmlEntities(stripPlaceholderNotes(markdown))
    .replace(/\\([[\]()])/g, "$1")
    .replace(/(?<=.) *\{right\}/g, "\n{right}");

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

  const writeRuns = (
    runs: Run[],
    options: { size: number; align?: "left" | "right"; gap: number },
  ) => {
    doc.fontSize(options.size);

    // PDFKit re-aligns every `continued` fragment independently, so combining
    // `continued` with `align: "right"` makes mixed-format runs overlap at the
    // right margin. Instead, measure the line and offset x manually, then flow
    // the runs left-to-right (the right-aligned lines here never wrap).
    if (options.align === "right") {
      const totalWidth = runs.reduce((width, run) => {
        doc.font(fontFor(run.bold, run.italic));
        return width + doc.widthOfString(run.text);
      }, 0);
      doc.x = doc.page.margins.left + (usableWidth - totalWidth);
    }

    runs.forEach((run, index) => {
      doc.font(fontFor(run.bold, run.italic));
      doc.text(run.text, {
        continued: index < runs.length - 1,
        align: options.align === "right" ? undefined : options.align,
      });
    });

    // Restore the left margin — a manual right-align offset (or any stray x)
    // would otherwise narrow the wrap width of every following line.
    doc.x = doc.page.margins.left;
    doc.moveDown(options.gap / options.size);
  };

  const renderTable = (
    rows: string[][],
    isHeader: boolean,
    // Cell origin and available width default to the full page so non-header
    // tables and body content are unaffected. The header table passes a reduced
    // width and a shifted origin so its columns sit to the right of the logo.
    originX: number = doc.page.margins.left,
    availWidth: number = usableWidth,
  ) => {
    const colCount = rows[0]?.length ?? 0;
    if (colCount === 0) {
      return;
    }
    const widths =
      isHeader && colCount === HEADER_COL_FRACTIONS.length
        ? HEADER_COL_FRACTIONS.map((f) => f * availWidth)
        : Array(colCount).fill(availWidth / colCount);

    // Agency identity columns (all but the last, which is the address) are bold
    // on real letterheads.
    const fontForCell = (ci: number): string =>
      isHeader && ci < colCount - 1 ? "Times-Bold" : "Times-Roman";

    // The letterhead renders slightly smaller than the body.
    doc.fontSize(isHeader ? HEADER_FONT_SIZE : BODY_FONT_SIZE);

    for (const cells of rows) {
      // Compute row height from the tallest cell.
      let rowHeight = 0;
      cells.forEach((cellText, ci) => {
        doc.font(fontForCell(ci));
        const h = doc.heightOfString(cellText, {
          width: widths[ci] - CELL_PADDING * 2,
        });
        if (h > rowHeight) {
          rowHeight = h;
        }
      });

      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      const rowY = doc.y;
      let cellX = originX;
      cells.forEach((cellText, ci) => {
        const alignRight = isHeader && ci === colCount - 1;
        doc.font(fontForCell(ci));
        doc.text(cellText, cellX + CELL_PADDING, rowY + CELL_PADDING, {
          width: widths[ci] - CELL_PADDING * 2,
          align: alignRight ? "right" : "left",
        });
        cellX += widths[ci];
      });

      doc.x = doc.page.margins.left;
      doc.y = rowY + rowHeight + CELL_PADDING * 2;
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
      while (i < lines.length && TABLE_ROW_REGEX.test(lines[i])) {
        if (!TABLE_SEPARATOR_REGEX.test(lines[i])) {
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
            // Place the logo in the left margin: its right edge meets the content
            // margin, extending left into the margin whitespace (clamped to the
            // page edge), so the table keeps the full width.
            const logoLeft = Math.max(2, doc.page.margins.left - LOGO_W);
            doc.image(
              `data:${options.logo.contentType};base64,${base64}`,
              logoLeft,
              logoTop,
              { fit: [LOGO_W, LOGO_H] },
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

        renderTable(tableRows, isFirstTable);
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

    // Right-aligned paragraph: {right}text
    if (line.startsWith("{right}")) {
      writeRuns(parseRuns(line.slice(7)), {
        size: BODY_FONT_SIZE,
        align: "right",
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
