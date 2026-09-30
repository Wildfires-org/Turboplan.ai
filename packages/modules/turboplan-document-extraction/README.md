# @wildfires-org/turboplan-document-extraction

Server-only plain-text extraction for project documents: PDF (via `unpdf`),
`.docx` (via `mammoth`) and legacy Word 97-2003 `.doc` (via `word-extractor`,
pure JS, MIT). Split out of `@wildfires-org/turboplan-documents` so
server consumers do not pull React, `react-pdf`, `docx-preview`, SWR and five
workspace packages along with the extractor.

Exports `.` (the extractor plus the MIME constants) and `./mime` (the three
document MIME constants alone, for client code that must not pull unpdf or
mammoth into its bundle).

Consumers: `@wildfires-org/turboplan-documents/server` (which re-exports the
same symbols for existing callers) and the research-agent Fly app.

Memory notes — the extractor is expected to run in ~512MB:

- The fetched body is capped at 50MB and handed to `unpdf` as a zero-copy
  `Uint8Array` view.
- PDFs are read one page at a time, each page released with `page.cleanup()`
  and the document with `pdf.destroy()`; extraction stops at
  `MAX_EXTRACTED_CHARS` (40k) or `MAX_PDF_PAGES` (400), whichever comes first.
- `.docx` archives get a zip-bomb prescan before `mammoth` inflates them.
- `.doc` files must start with the OLE2 compound-file signature; the parser only
  sees the already size-capped buffer. Body text plus footnotes and endnotes
  are kept (headers/footers are skipped). A `.docx` that arrives labelled as
  `.doc` is routed to the `.docx` path, prescan included.
- `extractDocumentText` takes an optional `AbortSignal` so worker-thread
  callers can kill a runaway job; the 30s fetch timeout still applies.

Tests: `pnpm --filter @wildfires-org/turboplan-document-extraction test`. The
`.doc` fixture in `tests/fixtures/` was generated with macOS
`textutil -convert doc` from a short plain-text memo.
