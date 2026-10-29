---
"turboplan": minor
"turboplan-server": minor
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/research-agent": minor
"@wildfires-org/turboplan-research-agent-integration": minor
"@wildfires-org/turboplan-documents": patch
---

Organizations get a Context page (new "Context" tab, behind the existing
project-context flag) where owners and editors write a standing prompt for the
AI (who the organization is, the standards it follows, how it likes work
written; up to 4,000 characters) and add reference documents (PDF, DOC, DOCX,
up to 50MB each, 100 per organization). Members and project collaborators can
read it; others cannot.

That context now reaches every project chat and research run in the
organization without sending the documents themselves. After text extraction,
the research agent's extraction loop writes a short key-facts summary of each
organization document with the fast model (`CLAUDE_FAST_MODEL`; without it the
first 400 characters are used). Each chat gets one budgeted block of at most
8,000 characters: the prompt, then summaries of pinned ("key") documents and
the newest ones, then titles of the rest. Research runs get the same block
capped at 3,000 characters in a new `<organization-context>` tag. A new chat
tool, `readOrganizationDocuments`, lists every organization document and opens
a document's full text on demand.
Chats only receive the block when the user can read the organization.

Deleting a project document no longer removes the stored file while an
organization document still points at it (and the reverse).

New API routes: `GET`/`PUT /api/organizations/:id/context` and
`/api/organization-documents` (list, text, create, rename/pin, delete).

Migration `0005_serious_hammerhead` adds the `organization_context` and
`organization_document` tables; it only creates tables and is backward
compatible. Run it before deploying the research agent, whose extraction loop
now also polls `organization_document`. The research agent needs its own
`pnpm deploy` (in `apps/research-agent`) for the extraction loop and the
updated bootstrapper skill. Deployments with `USE_EXTERNAL_PROMPTS` on must
reseed or update the `research-agent-start-prompt` prompt (new
`{{organizationContext}}` variable) and the new
`tool-desc-read-organization-documents` prompt.
