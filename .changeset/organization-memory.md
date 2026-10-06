---
"turboplan": minor
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/turboplan-research-agent-integration": patch
---

Organization memory: the project chat can save short notes to the organization
context, and files can go to the organization from a project's Context page.

- **Saved notes:** when a user asks the assistant to remember something, or
  states a lasting organization-wide fact, the new `saveOrganizationMemory`
  tool saves it as a note of up to 300 characters. Only organization owners
  and editors get the tool. An organization holds up to 50 notes, and
  duplicates are not saved twice.
- **Notes reach the AI:** every project chat and research run in the
  organization sees the newest notes in the organization context, capped at
  2,500 characters in chat and 800 in research so document facts keep room.
- **Easy to delete:** the organization Context page has a Memory section, and
  a project's Context page has an "{organization} context" panel listing notes
  and organization files. Each note deletes in one click. In chat, a "Saved to
  {organization} context" card shows the note with Delete and Manage.
- **Upload target:** a project's Context page lets editors choose
  "Add files to: Project / {organization}".
- **API:** `GET /api/organizations/:id/memories` and
  `DELETE /api/organization-memories/:id`, behind the project-context flag.

Run migration `0006_organization_memory.sql` (adds the `organization_memory`
table; additive and backward compatible) before deploying the API.
