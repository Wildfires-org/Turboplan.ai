# @wildfires-org/turboplan-document-extraction

Server-only plain-text extraction for project documents: PDF (via `unpdf`),
`.docx` (via `mammoth`) and legacy Word 97-2003 `.doc` (via `word-extractor`,
pure JS, MIT). Split out of `@wildfires-org/turboplan-documents` so
server consumers do not pull React, `react-pdf`, `docx-preview`, SWR and five
workspace packages along with the extractor.

Exports `.` (the extractor plus the MIME constants), `./mime` (the three
document MIME constants alone, for client code that must not pull unpdf or
mammoth into its bundle) and `./errors` (the generic user-facing failure
message, for the research agent's main thread, which must not load the
parsers either).

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
  `.doc` is routed to the `.docx` path, prescan included; RTF, HTML/MHTML and
  Word XML saved as `.doc` fail with a message that names the real format.
- `word-extractor` strips Word field codes with a backtracking regex that is
  quadratic on crafted input (an unclosed or oddly nested field start before
  a long run of text). `src/word-fields.ts` resolves fields in linear time
  first, hooked into the library's `buildDocument` step, so `word-extractor`
  is pinned to an exact version; `tests/word-fields.test.ts` fails if an
  upgrade moves that step, and a .doc is never parsed without the hook.
- The same hook rejects text with more than 1M characters that the library's
  clean-up rewrites one regex match at a time (paragraph marks, cell marks,
  curly quotes, NULs...). Past ~8M such characters `word-extractor` alone
  makes V8 abort the whole process, not just the worker; the flood tests run
  those shapes in a child process under the research agent's worker limits.
- `extractDocumentText` takes an optional `AbortSignal` so worker-thread
  callers can kill a runaway job; the 30s fetch timeout still applies.

Safety depends on the caller's worker limits, not only on these caps. The
50MB size cap bounds the input, not the parse time or heap: the parsers have
other super-linear paths (e.g. `word-extractor` rewrites a piece's whole text
for every deleted-text run). The research agent runs each extraction in a
worker thread with a heap cap and a timeout (shorter for legacy `.doc`), and
the queue is processed one document at a time, so those limits are what keep
one hostile file from stalling everyone else's uploads. A worker thread's
heap cap does not contain every out-of-memory, though: when one allocation
cannot be satisfied even after V8 raises the limit to finish a GC, V8 aborts
the process. The guards above close the known `.doc` cases; only a separate
process would contain unknown ones.

Failures carry a user-facing `message` (stored as `extraction_error` and shown
in the app) and, for unexpected parser errors, a raw `detail` for the logs
only.

Tests: `pnpm --filter @wildfires-org/turboplan-document-extraction test`. The
`.doc` fixture in `tests/fixtures/` was generated with macOS
`textutil -convert doc` from a short plain-text memo.
