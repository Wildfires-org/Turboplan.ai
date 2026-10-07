---
"turboplan": patch
"@wildfires-org/turboplan-ai": patch
"@wildfires-org/turboplan-db": patch
---

Documents drafted in chat start sooner, and a dropped connection no longer
loses them. The assistant now passes its reference document to the document
writer by URL (`referenceUrls` on `createDocument`) instead of retyping the
whole reference into its request, which took the better part of a minute; the
server injects the reference text (up to 10,000 characters each, at most two)
from the page the assistant already read, fetching it only if needed. Before
drafting it reads a reference the research already found instead of searching
for one, keeps its research note to one sentence, and the turn ends as soon as
the quick-reply suggestions are generated instead of making one more model
call. While the assistant prepares a document the chat shows "Preparing
"<title>"..." instead of only the typing dots.

A document being written is now saved every ~5 seconds while it streams (one
version, updated in place), so a run cut off mid-document keeps what was
written, and the document panel stops retrying after about a minute when a
cut-off run never saved anything. The `document-start` timing log gains
`referenceCount` and `referenceChars`.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`full-mode` prompt to pick up the new document workflow.
