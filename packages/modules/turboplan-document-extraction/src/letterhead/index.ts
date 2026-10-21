// Letterhead analysis of a document's first page: the vision prompt and output
// schema, and the pure geometry that turns the model's text blocks (matched to
// the PDF's own text where it has one), the page's logo boxes and the header's
// pixels into a letterhead grid — one row of text and logo cells. Pure (zod
// only): the research agent renders the page, calls the model and stores the
// logo crops; the web app copies the stored grid into documents.

export { type LogoCropper, toGridDraft } from "./grid";
export { findInkColor } from "./ink-color";
export {
  type BlockInk,
  fontSizeFromInk,
  measureBlockInk,
  measureLineInk,
} from "./ink-lines";
export {
  dropMarksInTextBlocks,
  filterPlacedLogos,
  findLogoMarks,
  isScannedHeader,
} from "./logo-marks";
export {
  buildLetterheadAnalysisPrompt,
  LETTERHEAD_MAX_HEADER_HEIGHT,
  LETTERHEAD_RENDER_WIDTH,
} from "./prompt";
export {
  type LetterheadAnalysisOutput,
  letterheadAnalysisOutputSchema,
} from "./schema";
export {
  type MatchedBlock,
  matchBlocksToText,
  toTextLines,
} from "./text-lines";
export type {
  Box,
  LetterheadAnalysis,
  LetterheadBlock,
  LetterheadCell,
  LetterheadGrid,
  LetterheadGridDraft,
  PdfTextItem,
} from "./types";
