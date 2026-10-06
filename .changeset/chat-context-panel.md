---
"turboplan": minor
"@wildfires-org/turboplan-documents": minor
---

Project chat: a "Context" button in the chat header (icon-only on phones)
opens a side panel over the chat, so context can be managed without leaving
it. Behind the project-context flag.

- **Add files:** the same "Add files to: Project / {organization}" switch and
  dropzones as the project Context page, sharing the remembered choice.
- **Organization context:** the organization's saved notes (one-click delete)
  and reference documents, with a link to the organization Context page.
- **Project documents:** files uploaded to the project, which can be renamed
  or deleted from the panel.
- A footer link opens the full project Context page.

`DocumentsSectionUI` gains an optional `singleColumn` prop for narrow
containers.
