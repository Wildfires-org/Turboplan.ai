---
"@wildfires-org/turboplan-document-extraction": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-db": patch
"@wildfires-org/turboplan-ai": patch
"turboplan": patch
---

Read legacy Word (.doc) files.

- **Extraction**: `extractDocumentText` now extracts `.doc` files with
  `word-extractor` (MIT, pure JS, runs in the research agent's worker thread).
  It keeps the body text plus footnotes and endnotes. The file must start with
  the OLE2 signature and stays under the existing 50 MB fetch cap and 40k
  character cap. A broken file comes back as `failed` with a readable message
  instead of `unsupported`, and a `.docx` labelled as `.doc` goes through the
  `.docx` path.
- **Database**: migration `0002_requeue_legacy_doc_extraction` puts `.doc`
  rows that were marked `unsupported` back to `pending`, so the extraction
  poller reads them.
- **API**: new `GET /api/project-documents/:id/text` returns
  `{ status, text, error }` for the document preview. Access is the same as
  the document list (READ on the project, or public-government module
  visibility), and responses are `Cache-Control: private, no-store`.
- **Chat**: `.doc` attachments are handled exactly like `.docx`. The
  `readProjectDocuments` tool description no longer tells the model that
  `.doc` files cannot be read.
