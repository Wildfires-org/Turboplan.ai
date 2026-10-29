---
"turboplan": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-db": minor
---

The chat assistant now picks the letterhead for each new document instead of
always using the office/organization default. When an organization has library
letterheads, the assistant is offered the default, each library letterhead and
"none", and chooses the one belonging to the document's author — e.g. a partner
agency's letterhead for a letter sent on its behalf, or "none" for a consulting
firm's proposal, where the document writes the firm's own letterhead from the
reference. The choice is validated against the project's organization (anything
unknown falls back to the default), stored on the document before it is
generated, and shown in the preview and letterhead picker once generation
finishes; users can still change it with the picker. Organizations without
library letterheads see no change.

Library letterheads gain an optional "When to use" description (Organization
settings → Letterheads), which the assistant reads to choose between them.
Migration `0011_letterhead_description.sql` adds the column with an empty
default and is backward compatible.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`full-mode` prompt to pick up the letterhead instruction.
