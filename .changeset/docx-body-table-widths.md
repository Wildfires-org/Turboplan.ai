---
"turboplan": patch
"@wildfires-org/turboplan-signing": patch
---

Fix tables in exported DOCX documents rendering one character per line. Body
tables (every table after the letterhead) had no column widths, so the `docx`
library defaulted each column to 5pt; Word autofit past it, but other viewers
(browser DOCX previews, Pages, Google Docs) honored it and wrapped text letter
by letter. Body table columns are now sized to their content and span the full
page width, like the letterhead.

Body tables in the DOCX and PDF exports now also draw a visible grid (0.5pt
single borders) with a bold header row, and the PDF sizes their columns from
content instead of splitting the width equally, matching the DOCX. The
letterhead table stays borderless.
