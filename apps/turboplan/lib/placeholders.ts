// Shared parsing for review placeholders such as [INSERT: ...] and [ALL CAPS].
//
// Optional reviewer guidance can be appended inside a placeholder after a "||"
// separator, e.g. "[INSERT: city, state ZIP || use the field office's mailing
// city]". On export the guidance becomes a Word comment on that placeholder,
// but it is stripped from the on-screen document and from copied markdown so the
// reader only ever sees "[INSERT: city, state ZIP]".

export const PLACEHOLDER_NOTE_SEPARATOR = "||";

// No capturing groups inside, so this source composes cleanly with String.split
// and custom wrappers. The colon form allows any inner punctuation (commas,
// periods, parens). The bare form requires an uppercase start, no lowercase, and
// a restricted character set (caps, digits, spaces, and a few separators common
// in agency names) — broad enough for "[FILE CODE]" or "[FIELD OFFICE NAME]" but
// narrow enough to skip ordinary bracketed prose and citations like
// "[SEE 40 C.F.R. § 1500]" that would otherwise become spurious review comments.
export const PLACEHOLDER_SOURCE =
  "\\[INSERT:\\s*[^\\]]+\\]|\\[[A-Z][A-Z0-9 .,()&/_-]{2,}\\]";

export const createPlaceholderRegex = (): RegExp =>
  new RegExp(PLACEHOLDER_SOURCE, "g");

// One capturing group around the whole token, so String.split keeps the
// placeholder tokens in its result.
export const createSplitPlaceholderRegex = (): RegExp =>
  new RegExp(`(${PLACEHOLDER_SOURCE})`, "g");

export type ParsedPlaceholder = {
  /** The field description, without any reviewer note. */
  desc: string;
  /** Reviewer guidance to surface as a comment; empty when none was provided. */
  note: string;
  /** How the placeholder should appear on screen and in copied markdown. */
  visible: string;
};

export const parsePlaceholder = (token: string): ParsedPlaceholder => {
  const inner = token.slice(1, -1);
  const colonMatch = inner.match(/^INSERT:\s*([\s\S]*)$/);
  const isColon = colonMatch !== null;
  const body = isColon ? colonMatch[1] : inner;

  const sepIndex = body.indexOf(PLACEHOLDER_NOTE_SEPARATOR);
  const desc = (sepIndex >= 0 ? body.slice(0, sepIndex) : body).trim();
  const note =
    sepIndex >= 0
      ? body.slice(sepIndex + PLACEHOLDER_NOTE_SEPARATOR.length).trim()
      : "";

  const visible = isColon ? `[INSERT: ${desc}]` : `[${desc}]`;
  return { desc, note, visible };
};

// Removes reviewer-guidance notes from every placeholder so they never appear in
// on-screen markdown or copied text. The artifact's stored content keeps the
// notes so the docx export can still turn them into comments.
export const stripPlaceholderNotes = (text: string): string =>
  text.replace(
    createPlaceholderRegex(),
    (token) => parsePlaceholder(token).visible,
  );

// A "|| note" inside a markdown table row is toxic: the pipes add phantom
// column separators, so GFM renderers reject the table (it falls back to a
// paragraph of literal pipes) and the docx exporter's cell split shifts
// columns. The generator prompt forbids notes in table cells, but when the
// model emits one anyway we drop the note and keep the visible placeholder.
//
// A table row is any line with a pipe outside placeholder tokens — GFM allows
// rows without a leading "|" ("Head | Head"), so testing the first character
// is not enough. Pipes inside placeholders (the "|| note" separator itself)
// don't count: a paragraph whose only pipes come from a note is not a table,
// and its note must survive for the docx export. The check stays line-local
// so it works on streaming partial markdown, where the delimiter row may not
// have arrived yet.
export const stripPlaceholderNotesInTableRows = (text: string): string =>
  text
    .split("\n")
    .map((line) => {
      const outsideTokens = line.replace(createPlaceholderRegex(), "");
      if (!outsideTokens.includes("|")) {
        return line;
      }
      return line.replace(
        createPlaceholderRegex(),
        (token) => parsePlaceholder(token).visible,
      );
    })
    .join("\n");
