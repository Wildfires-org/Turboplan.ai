---
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-signing": patch
"turboplan-server": minor
---

Organizations can keep a library of up to 20 additional document letterheads
(e.g. a partner or client agency's), each with its own layout, lines, contact
and logo, managed at `/api/organizations/:organizationId/letterheads`
(list: READ, create/update/delete: UPDATE). Each chat document can choose its
letterhead — the office → organization default, a library letterhead, or none —
via `PUT /api/documents/:documentId/letterhead`. `GET /api/documents/letterhead`
and `/letterhead-logo` take an optional `documentId` and return the chosen
letterhead (plus the default and the library options); PDF export accepts a
`documentId`, and signing envelopes use the signed document's choice. Migration
`0008_document_letterhead_library` adds the `document_letterhead` and
`document_letterhead_selection` tables.
