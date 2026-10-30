// Description of a reference document's letterhead: computed once at upload
// (research agent), stored on the document row and copied into documents
// drafted from it. The grid is one row of cells, left to right — text cells
// holding their printed lines and logo cells — placed in fractions of the
// letterhead's horizontal span, so the app can redraw it at any width, and
// its base text size as a fraction of the page's width, so it can draw the
// text as large as it was printed.
// Structural copy in `@wildfires-org/turboplan-db` (`StoredLetterhead*`), which
// does not depend on this package — keep them in sync. Pure: no server, db or
// parser imports.

// Smallest to largest. Keep in sync with `GRID_LINE_SIZES`
// (`@wildfires-org/turboplan-workspace`).
export type LetterheadLineSize =
  | "small"
  | "normal"
  | "large"
  | "xlarge"
  | "xxlarge";

// One printed line of a text cell.
export type LetterheadLine = {
  text: string;
  bold: boolean;
  // Relative to the letterhead's usual text size (the grid's `fontSize`).
  size: LetterheadLineSize;
};

export type LetterheadAlignment = "left" | "center" | "right";

// Where a cell shorter than the row sits in the row's height; a cell without
// one sits at the top. "top" is never stored.
export type LetterheadVerticalAlignment = "middle" | "bottom";

// `x` and `width` are fractions (0–1) of the letterhead's horizontal span
// (left edge of its first cell to right edge of its last); a logo's `height`
// is a fraction of that same span width, so the renderer keeps its aspect.
// Cells are ordered by `x` and may overlap a little (text columns up to a few
// pixels, a logo less than half its width): renderers place each cell at its
// own `x` rather than one after another.
export type LetterheadTextCell = {
  kind: "text";
  x: number;
  width: number;
  align: LetterheadAlignment;
  valign?: LetterheadVerticalAlignment;
  lines: LetterheadLine[];
};

export type LetterheadLogoCell = {
  kind: "logo";
  x: number;
  width: number;
  height: number;
  valign?: LetterheadVerticalAlignment;
  // R2 object key of the cropped logo image
  // (`letterheads/<source>/<documentId>/logo-<n>-<hash>.png`), never a public
  // URL: the app reads it with the bucket's credentials.
  key: string;
};

export type LetterheadCell = LetterheadTextCell | LetterheadLogoCell;

export type LetterheadGrid = {
  cells: LetterheadCell[];
  // Accent hex colour ("#1f5f3a") of the bold lines; null for plain ink.
  color: string | null;
  // The letterhead's base text size — the median height of its lines — as a
  // fraction of the reference page's width (not of the span: a narrow
  // centered header would blow its text up), so a renderer can draw it as
  // large as it was printed. Absent when no line's height is known.
  fontSize?: number;
};

export type LetterheadAnalysis = {
  hasLetterhead: boolean;
  // Null when the page has no letterhead.
  grid: LetterheadGrid | null;
};

// Pixel box, origin top-left.
export type Box = { x: number; y: number; width: number; height: number };

// One text block of a letterhead as the vision model reads it: lines stacked
// together in one column.
export type LetterheadBlock = {
  role: "name" | "contact";
  lines: string[];
  // Lettering drawn as part of the logo design (a lockup of the name and its
  // symbol): drawn as part of the logo, never as text. Absent: ordinary text.
  wordmark?: boolean;
  box: Box;
};

// One run of text the PDF draws (its text layer), in the render's pixel
// space. Digital PDFs have them; a scan has none. `bold` is read from the
// font's name when the PDF tells it; null when it does not.
export type PdfTextItem = {
  text: string;
  box: Box;
  bold: boolean | null;
};

// A logo cell before its crop is stored: the PNG instead of a key.
export type LetterheadLogoCrop = Omit<LetterheadLogoCell, "key"> & {
  png: Uint8Array;
};

// The analysis as the research agent's worker produces it: the grid's logo
// cells still carry their crops; the service stores them and fills the keys.
export type LetterheadGridDraft = {
  cells: (LetterheadTextCell | LetterheadLogoCrop)[];
  color: string | null;
  // See `LetterheadGrid`.
  fontSize?: number;
};
