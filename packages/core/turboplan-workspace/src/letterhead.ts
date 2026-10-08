// Structured document letterhead configured per office/organization. The app
// (not the AI) renders it as the FIRST markdown table of a generated document,
// which the PDF/DOCX exporters treat as the borderless letterhead. Client-safe:
// no server imports.

// "banner" is an uploaded, ready-made letterhead graphic (the logo image)
// rendered full content width; it has no text lines and no markdown table.
export type LetterheadLayout = "columns" | "split" | "centered" | "banner";

export type DocumentLetterhead = {
  layout: LetterheadLayout;
  nameLines: string[];
  contactLines: string[];
  // Accent hex color ("#1f5f3a") for the rule under the letterhead and the
  // bold name lines; null uses the default ink.
  color: string | null;
};

// Where the exporters place the letterhead logo for a layout: in the left page
// margin (agency style), inline at the content edge with the table to its right
// (firm style), centered above the table, or as the full-width banner.
export type LetterheadLogoPlacement = "margin" | "inline" | "above" | "banner";

export const LETTERHEAD_LAYOUTS: LetterheadLayout[] = [
  "columns",
  "split",
  "centered",
  "banner",
];

export const LETTERHEAD_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Stored color → a valid hex or null (bad/empty values never reach exporters).
export const normalizeLetterheadColor = (
  color: string | null | undefined,
): string | null => {
  const trimmed = color?.trim() ?? "";
  return LETTERHEAD_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
};

// Whether a letterhead has anything to render: name lines, or — for a banner —
// the letterhead graphic.
export const isLetterheadConfigured = (
  layout: LetterheadLayout | null | undefined,
  nameLines: string[],
  logoUrl: string | null | undefined,
): boolean => {
  if (layout === "banner") {
    return Boolean(logoUrl);
  }
  return nameLines.length > 0;
};

export const LETTERHEAD_LOGO_PLACEMENT: Record<
  LetterheadLayout,
  LetterheadLogoPlacement
> = {
  columns: "margin",
  split: "inline",
  centered: "above",
  banner: "banner",
};

export const parseLetterheadLines = (
  text: string | null | undefined,
): string[] =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const escapeCell = (text: string): string => text.replace(/\|/g, "\\|");

const bold = (text: string): string => (text ? `**${escapeCell(text)}**` : "");

const toRow = (cells: string[]): string => `| ${cells.join(" | ")} |`;

const buildColumns = (nameLines: string[], contactLines: string[]) => {
  const names = nameLines.map(bold);
  const contacts = contactLines.map(escapeCell);
  const separator = toRow([
    ...names.map(() => ":---"),
    ...(contacts.length > 0 ? ["---:"] : []),
  ]);
  if (contacts.length === 0) {
    return [toRow(names), separator];
  }
  const blanks = names.map(() => "");
  return [
    toRow([...names, contacts[0]]),
    separator,
    ...contacts.slice(1).map((contact) => toRow([...blanks, contact])),
  ];
};

const buildSplit = (nameLines: string[], contactLines: string[]) => {
  if (contactLines.length === 0) {
    const [first, ...rest] = nameLines.map((name) => toRow([bold(name)]));
    return [first, "| :--- |", ...rest];
  }
  const rowCount = Math.max(nameLines.length, contactLines.length);
  const rows = Array.from({ length: rowCount }, (_, i) =>
    toRow([bold(nameLines[i] ?? ""), escapeCell(contactLines[i] ?? "")]),
  );
  return [rows[0], "| :--- | ---: |", ...rows.slice(1)];
};

const buildCentered = (nameLines: string[], contactLines: string[]) => {
  const rows = nameLines.map((name) => toRow([bold(name)]));
  if (contactLines.length > 0) {
    rows.push(toRow([escapeCell(contactLines.join(" · "))]));
  }
  return [rows[0], "| :---: |", ...rows.slice(1)];
};

// Renders the letterhead as a GFM table whose separator row carries the column
// alignment the exporters lay the letterhead out with. A banner has no table
// ("") — the exporters draw its graphic from the branding logo instead.
export const buildLetterheadMarkdown = ({
  layout,
  nameLines,
  contactLines,
}: Pick<
  DocumentLetterhead,
  "layout" | "nameLines" | "contactLines"
>): string => {
  if (layout === "banner") {
    return "";
  }
  if (nameLines.length === 0 && contactLines.length === 0) {
    return "";
  }
  // Every layout needs at least one name cell to anchor the first row.
  const names = nameLines.length > 0 ? nameLines : [""];
  if (layout === "columns") {
    return buildColumns(names, contactLines).join("\n");
  }
  if (layout === "centered") {
    return buildCentered(names, contactLines).join("\n");
  }
  return buildSplit(names, contactLines).join("\n");
};

// True when the document already opens with a table — the exporters would
// treat it as the letterhead, so a structured one must not be stacked on top.
export const contentHasLetterheadTable = (markdown: string): boolean => {
  const firstLine = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  return firstLine?.startsWith("|") ?? false;
};

export const applyLetterhead = (
  content: string,
  letterheadMarkdown: string | null,
): string => {
  if (!letterheadMarkdown || contentHasLetterheadTable(content)) {
    return content;
  }
  return `${letterheadMarkdown}\n\n${content}`;
};

export type LetterheadBrandingPlan = {
  content: string;
  logoPlacement: LetterheadLogoPlacement | undefined;
  // Accent color the exporters use; only set when the letterhead is applied.
  color: string | null;
  // False when the resolved logo must not be drawn (a banner graphic that is
  // not rendered as the banner).
  keepLogo: boolean;
};

// How a document is branded with its resolved letterhead:
// - none → content unchanged, the (legacy) margin logo is kept;
// - a table layout → its table is prepended unless the content opens with its
//   own; placement + color only when prepended;
// - a banner → no table; "banner" placement when the graphic is available and
//   the content has no letterhead table of its own, otherwise no letterhead
//   at all (the wide graphic is never drawn as a margin logo).
export const planLetterheadBranding = (
  content: string,
  letterhead: DocumentLetterhead | null,
  hasLogo: boolean,
): LetterheadBrandingPlan => {
  const unbranded = {
    content,
    logoPlacement: undefined,
    color: null,
  };
  if (!letterhead) {
    return { ...unbranded, keepLogo: true };
  }

  if (letterhead.layout === "banner") {
    if (!hasLogo || contentHasLetterheadTable(content)) {
      return { ...unbranded, keepLogo: false };
    }
    return {
      content,
      logoPlacement: "banner",
      color: letterhead.color,
      keepLogo: true,
    };
  }

  const branded = applyLetterhead(content, buildLetterheadMarkdown(letterhead));
  if (branded === content) {
    return { ...unbranded, keepLogo: true };
  }
  return {
    content: branded,
    logoPlacement: LETTERHEAD_LOGO_PLACEMENT[letterhead.layout],
    color: letterhead.color,
    keepLogo: true,
  };
};

// ============================================================================
// LETTERHEAD LIBRARY + PER-DOCUMENT SELECTION
// ============================================================================

// An additional letterhead an organization keeps (e.g. a partner agency's).
export type LibraryLetterhead = {
  id: string;
  organizationId: string;
  name: string;
  layout: LetterheadLayout;
  lines: string;
  contact: string;
  logoUrl: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

// Which letterhead a document uses: the office → org default, none, or a
// library letterhead id.
export type LetterheadSelection = "default" | "none" | string;

export const MAX_LIBRARY_LETTERHEADS = 20;

// Selection stored for a document: no row → "default", a row with a null
// letterhead id → "none", else that id.
export const selectionFromRow = (
  row: { letterheadId: string | null } | null | undefined,
): LetterheadSelection => {
  if (!row) {
    return "default";
  }
  return row.letterheadId ?? "none";
};

// A library selection is honored only when the letterhead exists and belongs
// to the project's organization; anything else falls back to the default.
export const effectiveSelection = (
  selection: LetterheadSelection,
  letterheadOrganizationId: string | null | undefined,
  projectOrganizationId: string | null | undefined,
): LetterheadSelection => {
  if (selection === "default" || selection === "none") {
    return selection;
  }
  if (
    !letterheadOrganizationId ||
    !projectOrganizationId ||
    letterheadOrganizationId !== projectOrganizationId
  ) {
    return "default";
  }
  return selection;
};

// Library letterhead → the structured letterhead the exporters render, or null
// when it has nothing to render (same rule as the office/org letterhead: name
// lines, or a logo for a banner).
export const libraryLetterheadToDocumentLetterhead = (entry: {
  layout: LetterheadLayout | null;
  lines: string | null;
  contact: string | null;
  logoUrl?: string | null;
  color?: string | null;
}): DocumentLetterhead | null => {
  const layout = entry.layout ?? "split";
  const nameLines = parseLetterheadLines(entry.lines);
  if (!isLetterheadConfigured(layout, nameLines, entry.logoUrl)) {
    return null;
  }
  return {
    layout,
    nameLines: layout === "banner" ? [] : nameLines,
    contactLines:
      layout === "banner" ? [] : parseLetterheadLines(entry.contact),
    color: normalizeLetterheadColor(entry.color),
  };
};
