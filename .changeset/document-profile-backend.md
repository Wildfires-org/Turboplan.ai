---
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-workspace": minor
"turboplan-server": minor
---

Offices and organizations can keep a document profile — signatory, comment
contact (name, email, phone), office hours, default file code and free-form
facts — edited through the existing office/organization update endpoints
(`documentProfile`; an all-empty profile is stored as null).
`GET /api/documents/profile?projectId=` returns the project's merged profile
(office over organization, facts combined) and its fact lines, and
`POST /api/documents/remember-fact` appends a `label: value` fact to the
office that owns the project (UPDATE on that office). Migration
`0009_document_profile` adds the `document_profile` jsonb column to `office`
and `organization`.
