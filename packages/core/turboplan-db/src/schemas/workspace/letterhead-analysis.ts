import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Letterhead analysis the research agent stores on a reference document
 * (`project_document` / `organization_document`): whether its first page has a
 * letterhead and, if so, that header as a grid of cells a new document's
 * letterhead can copy. Structural copies of the types in
 * `@wildfires-org/turboplan-document-extraction/letterhead` (db does not
 * depend on it) — keep them in sync.
 *
 * `x`, `width` and `height` are fractions (0–1) of the header's horizontal
 * span, so a cell keeps its proportions at any page width; the grid's
 * `fontSize` is a fraction of the page's width.
 *
 * The same shape is stored as a document's own copy
 * (`document_own_letterhead.letterhead`) and as an office's or
 * organization's default (`document_letterhead_grid`).
 */
export type StoredLetterheadLine = {
  text: string;
  bold: boolean;
  /** Relative to the grid's base text size, smallest to largest. */
  size: "small" | "normal" | "large" | "xlarge" | "xxlarge";
};

/**
 * Where a cell shorter than the row sits in the row's height; a cell without
 * one sits at the top ("top" is never stored).
 */
export type StoredLetterheadVerticalAlign = "middle" | "bottom";

export type StoredLetterheadCell =
  | {
      kind: "text";
      x: number;
      width: number;
      align: "left" | "center" | "right";
      valign?: StoredLetterheadVerticalAlign;
      lines: StoredLetterheadLine[];
    }
  | {
      kind: "logo";
      x: number;
      width: number;
      height: number;
      valign?: StoredLetterheadVerticalAlign;
      /**
       * R2 object key of the logo image — a crop the research agent stored
       * (`letterheads/<source>/<documentId>/logo-<n>-<hash>.png`) or an
       * upload from the letterhead editor (`uploads/<userId>/…`). Never a
       * public URL: the server reads it with the bucket's credentials, so it
       * keeps working once the bucket is private.
       */
      key: string;
    };

export type StoredLetterheadGrid = {
  cells: StoredLetterheadCell[];
  /** Accent color (`#rrggbb`), or null when the header has none */
  color: string | null;
  /**
   * The header's base text size — the median height of its lines — as a
   * fraction (0–1) of the reference page's width (not of the span: a narrow
   * centered header would blow its text up). Renderers draw the text as
   * large as it was printed from it (`gridBaseFontRatio`); absent when the
   * analysis knew no line's height, or for grids stored before it was read.
   */
  fontSize?: number;
};

export type StoredLetterheadAnalysis = {
  hasLetterhead: boolean;
  grid: StoredLetterheadGrid | null;
};

/**
 * Lifecycle of a document's letterhead analysis (both document tables). Runs
 * independently of the text extraction.
 * - "pending": not analyzed yet (the default for every new row)
 * - "done": a letterhead was found; `letterheadAnalysis.grid` is set
 * - "none": no letterhead found, or the file is not a PDF
 * - "failed": the analysis failed for good (an unreadable PDF, an unusable
 *   answer), or ran out of attempts (`MAX_LETTERHEAD_ATTEMPTS`)
 */
export const DOCUMENT_LETTERHEAD_STATUSES = [
  "pending",
  "done",
  "none",
  "failed",
] as const;

export type DocumentLetterheadStatus =
  (typeof DOCUMENT_LETTERHEAD_STATUSES)[number];

/**
 * Analyses a pending document is given (`letterhead_attempts`, counted before
 * each run). A row still pending after the last one — a temporary failure each
 * time, or a PDF that crashed the process — is marked "failed" by the loop.
 */
export const MAX_LETTERHEAD_ATTEMPTS = 3;

/**
 * `<letterhead_status column> = 'pending'`: the predicate of the partial
 * pending-letterhead index on each document table and the filter of the
 * analysis loop's query it serves. The status is inlined rather than bound so
 * that a generic plan of a prepared statement still matches the index.
 */
export const letterheadPendingPredicate = (column: PgColumn): SQL =>
  sql`${column} = 'pending'`;
