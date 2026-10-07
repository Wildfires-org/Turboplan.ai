/**
 * Pure acceptance rule for model-generated next-step chips. Kept free of DB
 * and AI imports so it can be unit-tested in isolation.
 */

import type { SuggestionItem } from "../../types";

export const MAX_SUGGESTIONS = 8;

/** One chip as the model generates it, before normalization. */
export type GeneratedSuggestion = {
  label: string;
  content: string;
  emoji: string;
};

/**
 * Normalize one generated chip against the chips accepted so far. Fields are
 * trimmed; the chip is dropped (`null`) when its label or content is empty,
 * its label repeats an accepted one (case-insensitive), or the set already
 * holds {@link MAX_SUGGESTIONS} chips.
 */
export const acceptSuggestion = (
  item: GeneratedSuggestion,
  accepted: readonly SuggestionItem[],
): SuggestionItem | null => {
  if (accepted.length >= MAX_SUGGESTIONS) {
    return null;
  }

  const chip = {
    label: item.label.trim(),
    content: item.content.trim(),
    emoji: item.emoji.trim(),
  };
  if (!chip.label || !chip.content) {
    return null;
  }

  const key = chip.label.toLowerCase();
  if (accepted.some((existing) => existing.label.toLowerCase() === key)) {
    return null;
  }

  return chip;
};
