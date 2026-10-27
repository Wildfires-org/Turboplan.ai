// A grid letterhead line as every renderer sets it: its text, and how wide
// it is set, so the shared layout can tell whether it fits its column before
// any renderer draws it. Every renderer sets the letterhead in Times: the PDF
// in Times-Roman / Times-Bold, the DOCX and the preview in Times New Roman,
// whose advance widths are Times' for every ASCII character. Client-safe, no
// imports (the grid model and the layout both use it).

// Invisible or XML-invalid characters a PDF's text layer can carry: format
// characters (bidi overrides, zero-width spaces and joiners, soft hyphens),
// lone surrogates and the noncharacters U+FFFE / U+FFFF (either one makes a
// DOCX's document.xml unreadable).
const INVISIBLE_CHARS = /[\p{Cf}\p{Cs}\uFFFE\uFFFF]/gu;

/**
 * A grid line's text as every renderer and prompt uses it: the text comes
 * from a reference PDF, so invisible and XML-invalid characters are dropped
 * and whitespace and control characters collapse to single spaces (a newline
 * would break a table cell, a DOCX run or a prompt section); "" for a line
 * with nothing left, which callers skip.
 */
export const cleanGridLineText = (text: string): string =>
  text
    .replace(INVISIBLE_CHARS, "")
    .replace(/[\s\p{Cc}]+/gu, " ")
    .trim();

// Adobe's Times-Roman and Times-Bold AFM advance widths (thousandths of an
// em) of the printable ASCII characters, U+0020 to U+007E.
const TIMES_ROMAN = [
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250,
  278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564,
  564, 444, 921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611,
  889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333,
  278, 333, 469, 500, 333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278,
  500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500,
  444, 480, 200, 480, 541,
];
const TIMES_BOLD = [
  250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250,
  278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570,
  570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667,
  944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333,
  278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333,
  556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500,
  444, 394, 220, 394, 520,
];
const FIRST_ASCII = 0x20;

// Typographic punctuation letterheads print, [regular, bold].
const PUNCTUATION: Record<string, readonly [number, number]> = {
  "\u2018": [333, 333],
  "\u2019": [333, 333],
  "\u201c": [444, 500],
  "\u201d": [444, 500],
  "\u2013": [500, 500],
  "\u2014": [1000, 1000],
  "\u2022": [350, 350],
  "\u2026": [1000, 1000],
  "\u00b7": [250, 250],
};

// Any other character counts as a full em, so a line is never measured
// narrower than it is drawn.
const UNKNOWN_WIDTH = 1000;

// Accents once a line is decomposed: an accented letter is as wide as its
// base letter (é as e).
const COMBINING_MARKS = /\p{M}/gu;

const charWidth = (char: string, bold: boolean): number => {
  const ascii = (bold ? TIMES_BOLD : TIMES_ROMAN)[
    (char.codePointAt(0) ?? 0) - FIRST_ASCII
  ];
  if (ascii !== undefined) {
    return ascii;
  }
  const punctuation = PUNCTUATION[char];
  return punctuation ? punctuation[bold ? 1 : 0] : UNKNOWN_WIDTH;
};

/**
 * A line's width set in Times, bold or regular, in ems: its characters'
 * advance widths without kerning — what Word sets (it does not kern by
 * default), and never narrower than the PDF or a browser sets it (they kern).
 */
export const gridTextWidth = (text: string, bold: boolean): number =>
  [...text.normalize("NFD").replace(COMBINING_MARKS, "")].reduce(
    (width, char) => width + charWidth(char, bold),
    0,
  ) / 1000;
