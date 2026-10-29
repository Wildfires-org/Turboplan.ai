---
"turboplan": patch
"@wildfires-org/turboplan-ai": patch
---

Asking the chat for a different document (e.g. a fire behavior report after a
proposal was drafted) no longer overwrites the existing document. The assistant
was routing such requests to `updateDocument`, which rewrote the proposal's body
under its title. The create/update tool descriptions and the full-mode workflow
now state that a new document always uses `createDocument` and that
`updateDocument` is only for explicit edits to that same document, and the
project tasks context's "update existing" rules are scoped to task documents.

Two related artifact-panel fixes: `updateDocument` now points the panel at the
document it rewrites (kind, id, title) before streaming, so the update no longer
appears under whichever document happened to be open; and the panel no longer
saves the editor while the AI is streaming, which could store half-generated
text as the latest version.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`tool-desc-create-document`, `tool-desc-update-document` and `full-mode`
prompts.
