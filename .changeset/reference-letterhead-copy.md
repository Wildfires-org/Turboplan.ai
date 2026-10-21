---
"turboplan": minor
"turboplan-server": minor
"@wildfires-org/research-agent": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-document-extraction": minor
"@wildfires-org/turboplan-signing": minor
"@wildfires-org/turboplan-upload": minor
"@wildfires-org/turboplan-env": minor
"@wildfires-org/turboplan-ai": patch
"@wildfires-org/turboplan-mcp-server": patch
---

Documents drafted from a reference now carry a copy of that reference's
letterhead — its text, logo(s), column layout, accent colour and text size —
drawn the same way in the document preview, the PDF export and signing
envelopes, and the DOCX export. Lines keep the size they were printed at
(within 6.5–13 pt), including lettering drawn as an image, and a text column
uses the free space beside it so a line that fit in the original does not
wrap. Lettering that is part of a logo stays in the logo image, and columns
keep their vertical position (top, middle or bottom), which the letterhead
editor can change.

- **Documents**: when the chat drafts a document from a saved reference (an
  uploaded PDF, or one the research agent saved), the document gets its own
  copy of the reference's letterhead. The copy wins over the office or
  organization default letterhead; only a library letterhead the user named
  replaces it. The reply names the file the letterhead came from, and the
  document is written as that letterhead's sender. A document the research
  agent saved from another project is used for structure and style only: its
  letterhead is offered in the Letterhead menu but not applied. When the
  reference's letterhead is still being read, the reply says so.
- **Letterhead menu**: "From <file>" switches back to the copy; "Edit
  letterhead…" edits it (lines, bold and size, alignment, columns, logo
  replace or remove, colour), changing only that document; "Save as
  organization letterhead…" (or the office's, when the office has a letterhead
  of its own) makes it the default for every document set to "Default".
  Editing needs project edit rights; saving as a default needs edit rights on
  the organization or office.
- **Settings**: organization and office settings show a saved letterhead with
  Edit and Remove; after Remove the layout settings apply again.
- **Research agent**: every uploaded PDF (project and organization documents)
  has its letterhead analyzed once, in the background — about $0.004 per PDF
  with Haiku 4.5. `CLAUDE_LETTERHEAD_MODEL` (optional, defaults to
  `CLAUDE_FAST_MODEL`, `off` disables it) runs through OpenRouter only, so
  the analysis is off without `OPENROUTER_API_KEY`. Logo crops are stored in
  the API's R2 bucket when the research agent has `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME` (Fly
  secrets; no `R2_PUBLIC_URL`); without them letterheads are copied without
  logos. Each PDF is tried at most 3 times, after a model API error the
  analysis pauses for 5 minutes, page images over 12M pixels are skipped, and
  text extraction and letterhead analysis no longer run their PDF workers at
  the same time.
- **References**: the assistant passes documents saved to the project or
  organization by ID (`referenceDocumentIds`); `getContents` no longer sends
  our own storage URLs to Exa and points the assistant to the document tools
  instead.
- **API**: new `PUT /api/documents/:documentId/letterhead/own`;
  `GET|PUT|DELETE /api/organizations/:organizationId/letterhead-grid` and
  `/api/offices/:officeId/letterhead-grid`, each with `GET …/logo?index=` and
  `POST …/from-document`; `GET /api/projects/:projectId/letterhead-target`.
  `PUT /api/documents/:documentId/letterhead` accepts `"own"`,
  `GET /api/documents/letterhead` returns `own` and a `grid` layout, and
  `GET /api/documents/letterhead-logo` takes `index`. Organization and office
  payloads never include the saved letterhead grid.
- **Storage**: letterhead logos are stored as R2 object keys and read by the
  API with its R2 credentials, so they keep working with a private bucket.
  `R2_PUBLIC_URL` may list several comma-separated bases: the first is where
  new objects are written, the rest are read-only aliases.
- **Database**: migration `0012_reference_letterhead.sql` adds the letterhead
  analysis status, attempt count and result to both document tables, the
  `document_own_letterhead` table, `use_own` on letterhead selections and
  `document_letterhead_grid` on organizations and offices. Additions only and
  backward compatible; existing documents start as `pending`, so every PDF
  already uploaded is analyzed once after the deploy.
- **Prompts**: deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update
  `full-mode`, `text-document`, `tool-desc-create-document-footer` and
  `tool-desc-get-contents`. The letterhead list offered to the assistant and
  the generator's letterhead section are built in code.
