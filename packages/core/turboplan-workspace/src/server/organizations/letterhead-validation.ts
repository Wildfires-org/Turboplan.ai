import { z } from "zod";

import { LETTERHEAD_COLOR_PATTERN } from "../../letterhead";

export const letterheadLayoutSchema = z.enum([
  "columns",
  "split",
  "centered",
  "banner",
]);

// Accent color as "#rrggbb"; "" clears it (stored as null).
export const letterheadColorSchema = z
  .string()
  .regex(LETTERHEAD_COLOR_PATTERN, "Color must be a hex value like #1f5f3a")
  .or(z.literal(""));

// Body of POST/PUT /api/organizations/:organizationId/letterheads[/:id].
// An empty logoUrl / color clears it (stored as null). An omitted description
// is stored as "". A banner letterhead is its logo image, so it needs no name
// lines.
export const libraryLetterheadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be at most 80 characters"),
  description: z
    .string()
    .trim()
    .max(300, "Description must be at most 300 characters")
    .optional(),
  layout: letterheadLayoutSchema,
  lines: z
    .string()
    .max(400, "Letterhead name lines must be at most 400 characters"),
  contact: z
    .string()
    .max(400, "Letterhead contact lines must be at most 400 characters"),
  logoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  color: letterheadColorSchema.optional(),
});

export type LibraryLetterheadFormData = z.infer<typeof libraryLetterheadSchema>;
