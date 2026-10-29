---
"@wildfires-org/turboplan-db": patch
"@wildfires-org/turboplan-workspace": patch
"@wildfires-org/turboplan-signing": patch
"turboplan-server": patch
---

Offices and organizations can store a structured document letterhead (layout
`columns`, `split` or `centered`, name lines and contact lines) next to their
other document branding; the office's letterhead wins over the organization's.
PDF exports and signing envelopes for a project prepend it as the letterhead
table unless the document already opens with one, and place the logo to match
the layout: in the page margin (columns), beside the letterhead (split) or
centered above it (centered). `GET /api/documents/letterhead?projectId=` returns
the resolved letterhead and its markdown. Signing envelopes now also carry the
project's letterhead logo and footer. Migration `0007_document_letterhead` adds
the six nullable columns.
