import { z } from "zod";

// Only APIs present in both zod v3 and v4 (shared packages may be bundled
// with "zod" aliased to "zod/v3").

const boxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

/**
 * What the vision model returns for {@link buildLetterheadAnalysisPrompt}.
 * Deliberately loose: a block list the model leaves out falls back to empty
 * instead of failing the whole analysis. Logo positions never come from the
 * model (its boxes were measured to be unreliable) but from the PDF's image
 * draws or the pixels.
 */
export const letterheadAnalysisOutputSchema = z.object({
  hasLetterhead: z.boolean(),
  blocks: z
    .array(
      z.object({
        role: z.enum(["name", "contact"]).catch("contact"),
        lines: z.array(z.string()).catch([]),
        // Left out or unreadable: ordinary text.
        wordmark: z.boolean().catch(false),
        box: boxSchema,
      }),
    )
    .nullish()
    .transform((blocks) => blocks ?? []),
});

export type LetterheadAnalysisOutput = z.infer<
  typeof letterheadAnalysisOutputSchema
>;
