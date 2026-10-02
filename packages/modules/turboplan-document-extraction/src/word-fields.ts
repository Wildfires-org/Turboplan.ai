import { createRequire } from "node:module";

import { DocumentReadError, WORD_RESAVE_HINT } from "./errors";

/**
 * Linear-time removal of Word field codes, run before `word-extractor`'s own
 * `clean()`.
 *
 * A Word field is `\x13 instruction \x14 result \x15` (the separator and result
 * are optional) and fields nest. `clean()` strips them with a backtracking
 * regex, repeated until nothing matches, which is quadratic whenever a `\x13`
 * is followed by a long run of text the pattern cannot close: an unmatched
 * start, or nesting such as `\x13 <long text> \x13 x \x15 \x15`. A crafted
 * .doc of about a million characters would hold the (single, global)
 * extraction queue until the worker timeout. Counting starts against ends is
 * not enough, since balanced nesting is quadratic too.
 *
 * So every field is resolved here with a stack in two linear passes: a
 * character survives only when it sits in the result part of every field
 * around it, which is what the regex loop produces for well-formed fields.
 * Field markers and instruction text become NUL, which `clean()` deletes, so
 * the text keeps its length (the piece table addresses it by character
 * position) and `clean()` finds no field left to match. An unmatched start is
 * dropped and the text after it kept. Stray separators and ends are left
 * exactly as the library leaves them: its regex only starts at `\x13`, so
 * they cost it nothing, whereas turning a flood of them into NULs would hand
 * its NUL-stripping pass millions of matches.
 *
 * Memory is bounded by the input, never by the number of fields: one typed
 * array of roles, stacks capped at MAX_OPEN_FIELDS, and one off-heap copy of a
 * segment that is edited in place. Building the result from a string per
 * kept/dropped run instead let a marker-dense .doc (~24M markers) exhaust the
 * worker heap inside a single `join`, which V8 treats as fatal for the whole
 * process rather than as a recoverable worker OOM.
 */

const FIELD_BEGIN = 0x13;
const FIELD_SEPARATOR = 0x14;
const FIELD_END = 0x15;
const FIELD_MARKER_PATTERN = /[\x13-\x15]/;
// Each character is one UTF-16 code unit; NUL is two zero bytes.
const BYTES_PER_UNIT = 2;

// Pass 1 output: the markers pass 2 removes. Everything else is 0.
const ROLE_BEGIN = 1;
const ROLE_SEPARATOR = 2;
const ROLE_END = 3;
const ROLE_UNMATCHED_BEGIN = 4;

/**
 * Open fields allowed at once (nesting depth plus unclosed starts). Real
 * documents stay in single digits; past this the file is rejected instead of
 * growing the stacks without bound.
 */
export const MAX_OPEN_FIELDS = 1_000;

/**
 * Pass 1: find the begin, first separator and end of every complete field,
 * and every start that never closes.
 */
const findFieldRoles = (
  segments: ReadonlyArray<string>,
  totalLength: number,
): Uint8Array => {
  const roles = new Uint8Array(totalLength);
  const openBegins: number[] = [];
  // Separator position for each open field, -1 until one is seen.
  const openSeparators: number[] = [];
  let offset = 0;

  for (const segment of segments) {
    for (let index = 0; index < segment.length; index++) {
      const code = segment.charCodeAt(index);
      const position = offset + index;

      if (code === FIELD_BEGIN) {
        if (openBegins.length >= MAX_OPEN_FIELDS) {
          throw new DocumentReadError(
            `This .doc file has too many nested fields to read. ${WORD_RESAVE_HINT}`,
          );
        }
        openBegins.push(position);
        openSeparators.push(-1);
      } else if (code === FIELD_SEPARATOR) {
        const top = openSeparators.length - 1;
        if (top >= 0 && openSeparators[top] === -1) {
          openSeparators[top] = position;
        }
      } else if (code === FIELD_END) {
        const begin = openBegins.pop();
        const separator = openSeparators.pop();
        if (begin !== undefined && separator !== undefined) {
          roles[begin] = ROLE_BEGIN;
          roles[position] = ROLE_END;
          if (separator !== -1) {
            roles[separator] = ROLE_SEPARATOR;
          }
        }
      }
    }
    offset += segment.length;
  }

  for (const begin of openBegins) {
    roles[begin] = ROLE_UNMATCHED_BEGIN;
  }

  return roles;
};

/**
 * Strip field codes from consecutive text segments (fields may span them).
 * Returns segments of the same lengths, with removed characters set to NUL.
 * A segment with nothing to remove is returned as is.
 */
export const stripFieldCodes = (
  segments: ReadonlyArray<string>,
): Array<string> => {
  if (!segments.some((segment) => FIELD_MARKER_PATTERN.test(segment))) {
    return [...segments];
  }

  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const roles = findFieldRoles(segments, totalLength);

  // Pass 2: one entry per open complete field, 1 while in its instruction.
  const fieldStates: number[] = [];
  let openInstructions = 0;
  let offset = 0;

  return segments.map((segment) => {
    // Copied only once the segment turns out to need an edit.
    let units: Buffer | null = null;

    for (let index = 0; index < segment.length; index++) {
      const role = roles[offset + index];
      if (role !== 0 || openInstructions > 0) {
        units ??= Buffer.from(segment, "utf16le");
        units[index * BYTES_PER_UNIT] = 0;
        units[index * BYTES_PER_UNIT + 1] = 0;
      }

      if (role === ROLE_BEGIN) {
        fieldStates.push(1);
        openInstructions++;
      } else if (role === ROLE_SEPARATOR) {
        fieldStates[fieldStates.length - 1] = 0;
        openInstructions--;
      } else if (role === ROLE_END) {
        if (fieldStates.pop() === 1) {
          openInstructions--;
        }
      }
    }

    offset += segment.length;
    return units ? units.toString("utf16le") : segment;
  });
};

/**
 * `clean()` and `filter()` rewrite these one regex match at a time (most of
 * them through a callback), and the matches of one pass are all held at once.
 * Under the research agent's worker limits (256MB old space) a pass fails
 * from about 2M matches, and from about 8M V8 aborts the whole process
 * instead of just the worker. 1M stays well clear (under 0.2s per pass) and
 * is far above what a real document needs (one per paragraph, table cell,
 * line or page break, curly quote or dash).
 */
export const MAX_CHARACTERS_TO_CLEAN = 1_000_000;

// clean(): [\x02\x05\x07\x08\x0a-\x0d\x1f] then [\x00-\x07]; filter(): the
// typographic spaces, dashes and quotes.
const isRewrittenByLibrary = (code: number): boolean =>
  (code <= 0x0d && code !== 0x09) ||
  code === 0x1f ||
  code === 0x2002 ||
  code === 0x2003 ||
  (code >= 0x2012 && code <= 0x2014) ||
  code === 0x2018 ||
  code === 0x2019 ||
  code === 0x201c ||
  code === 0x201d;

/**
 * Reject text whose library clean-up would hold too many matches at once.
 * Runs after `stripFieldCodes`, so the NULs it leaves are counted too.
 */
export const assertCleanable = (texts: ReadonlyArray<string>): void => {
  let count = 0;
  for (const text of texts) {
    for (let index = 0; index < text.length; index++) {
      if (isRewrittenByLibrary(text.charCodeAt(index))) {
        count++;
        if (count > MAX_CHARACTERS_TO_CLEAN) {
          throw new DocumentReadError(
            `This .doc file is too large or complex to read. ${WORD_RESAVE_HINT}`,
          );
        }
      }
    }
  }
};

type TextHolder = { text: string };

type WordOleExtractorInternals = {
  _pieces?: Array<TextHolder>;
  _taggedHeaders?: Array<TextHolder>;
};

type BuildDocument = (this: WordOleExtractorInternals) => unknown;

// Marked on the prototype itself, not in a module variable, so a second copy
// of this module (e.g. src and dist in one process) cannot wrap it twice.
const GUARD_MARK = Symbol.for("turboplan.wordFieldCodeGuard");

type GuardedPrototype = {
  buildDocument?: BuildDocument;
  [GUARD_MARK]?: true;
};

/**
 * Run `stripFieldCodes` and `assertCleanable` over the text `word-extractor`
 * is about to `clean()`: the piece table (body, footnotes, endnotes,
 * annotations, text boxes) and the header/footer strings collected before it.
 * Hooks `WordOleExtractor.prototype.buildDocument`, the step that calls
 * `clean()`, which is why `word-extractor` is pinned to an exact version. The
 * pathological-input tests fail if an upgrade moves that step. Throws when the
 * hook cannot be installed; callers must not parse a .doc without it.
 */
export const installFieldCodeGuard = (): void => {
  const require = createRequire(import.meta.url);
  const { prototype } = require("word-extractor/lib/word-ole-extractor.js") as {
    prototype: GuardedPrototype;
  };
  if (prototype[GUARD_MARK]) {
    return;
  }

  const buildDocument = prototype.buildDocument;
  if (typeof buildDocument !== "function") {
    throw new Error("word-extractor no longer exposes buildDocument");
  }

  prototype.buildDocument = function (this: WordOleExtractorInternals) {
    const pieces = this._pieces ?? [];
    const strippedPieces = stripFieldCodes(pieces.map((piece) => piece.text));
    pieces.forEach((piece, index) => {
      piece.text = strippedPieces[index];
    });

    const headers = this._taggedHeaders ?? [];
    for (const header of headers) {
      [header.text] = stripFieldCodes([header.text]);
    }

    assertCleanable([
      ...pieces.map((piece) => piece.text),
      ...headers.map((header) => header.text),
    ]);

    return buildDocument.call(this);
  };
  prototype[GUARD_MARK] = true;
};
