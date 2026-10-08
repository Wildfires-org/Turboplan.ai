// Collecting and filling the review placeholders of a markdown document, for
// the "Fill in placeholders" panel. Parsing of a single token lives in
// placeholders.ts.

import { createPlaceholderRegex, parsePlaceholder } from "@/lib/placeholders";

export type OpenPlaceholder = {
  /** The exact token as it appears in the markdown, including any note. */
  token: string;
  /** The field description, without the "— suggested: …" part. */
  label: string;
  /** The suggested value from "— suggested: value"; empty when none. */
  suggested: string;
  /** Reviewer guidance after "||"; empty when none. */
  note: string;
  /** How many times this exact token appears in the document. */
  count: number;
};

// "comment email — suggested: a@b.gov" → label + suggested value. The model
// writes an em dash, but en dashes and hyphens show up too.
const SUGGESTED_SEPARATOR = /\s+[—–-]{1,2}\s*suggested:\s*/i;

export const splitSuggestedValue = (
  desc: string,
): { label: string; suggested: string } => {
  const match = desc.match(SUGGESTED_SEPARATOR);
  if (!match || match.index === undefined) {
    return { label: desc, suggested: "" };
  }
  return {
    label: desc.slice(0, match.index).trim(),
    suggested: desc.slice(match.index + match[0].length).trim(),
  };
};

// Unique placeholder tokens in document order, with their occurrence count.
// Identical tokens are grouped; tokens that differ only in their note stay
// separate because they are replaced by exact token.
export const collectPlaceholders = (content: string): OpenPlaceholder[] => {
  const byToken = new Map<string, OpenPlaceholder>();

  for (const token of content.match(createPlaceholderRegex()) ?? []) {
    const existing = byToken.get(token);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const { desc, note } = parsePlaceholder(token);
    const { label, suggested } = splitSuggestedValue(desc);
    byToken.set(token, { token, label, suggested, note, count: 1 });
  }

  return [...byToken.values()];
};

// A table row is any line with a pipe outside placeholder tokens (same rule as
// stripPlaceholderNotesInTableRows). A raw "|" in a filled value would add a
// phantom column there, so it is escaped.
const isTableRow = (line: string): boolean =>
  line.replace(createPlaceholderRegex(), "").includes("|");

// Replaces every occurrence of the exact token with the value.
export const fillPlaceholder = (
  content: string,
  token: string,
  value: string,
): string => {
  const trimmed = value.trim().replace(/\s*\n\s*/g, " ");
  if (!trimmed) {
    return content;
  }
  const tableValue = trimmed.replace(/(?<!\\)\|/g, "\\|");

  return content
    .split("\n")
    .map((line) => {
      if (!line.includes(token)) {
        return line;
      }
      return line.split(token).join(isTableRow(line) ? tableValue : trimmed);
    })
    .join("\n");
};

// Applies several fills at once; empty values are skipped.
export const fillPlaceholders = (
  content: string,
  fills: ReadonlyArray<{ token: string; value: string }>,
): string =>
  fills.reduce(
    (current, { token, value }) => fillPlaceholder(current, token, value),
    content,
  );
