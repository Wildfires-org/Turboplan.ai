# @wildfires-org/turboplan-document-extraction

Server-only plain-text extraction for project documents: PDF (via `unpdf`) and
`.docx` (via `mammoth`). Split out of `@wildfires-org/turboplan-documents` so
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
- `extractDocumentText` takes an optional `AbortSignal` so worker-thread
  callers can kill a runaway job; the 30s fetch timeout still applies.
