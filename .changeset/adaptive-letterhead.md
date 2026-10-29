---
"turboplan": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/turboplan-signing": minor
---

Generated documents no longer force a fixed four-column agency letterhead. The
document generator now lays out the letterhead to mirror the reference document
and the author (e.g. a firm's proposal gets a two-column firm-name / address
header instead of an agency one): 1–4 columns, per-column alignment encoded in
the table's separator row (`:---`, `:---:`, `---:`), bold only where the
markdown says so, and a new `{center}` line prefix for centered title blocks.
The chat agent passes a short "LETTERHEAD LAYOUT" note to the generator, since
the reference reaches it as plain text only.

The DOCX and PDF exports size letterhead columns from their content instead of
fixed 22/13/28/37% widths (which wrapped long names across several lines),
honor column alignment and `{center}`, keep bold placeholders bold, and render
bold inside PDF table cells instead of printing literal `**`. The DOCX
letterhead and footer now span the real A4 content width, so they no longer
overrun the right margin. Editing a document keeps its alignment markers, bold
and `{center}` lines. Letterheads stored without alignment markers keep their
previous bold/right-aligned rendering.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`text-document`, `full-mode` and `update-document-text` prompts to pick
up the new letterhead instructions.
