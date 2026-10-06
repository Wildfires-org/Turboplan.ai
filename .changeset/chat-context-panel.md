---
"turboplan": minor
"@wildfires-org/turboplan-documents": minor
---

Project Context in two tabs, and in the project chat. Behind the
project-context flag.

- **Chat panel:** a "Context" button in the project chat header (icon-only on
  phones) opens a side panel over the chat, so context can be managed without
  leaving it. A footer link opens the full project Context page.
- **Project | Organization tabs** on both the panel and the project Context
  page, remembered per user. The Project tab holds only project things: the
  file dropzone, uploaded documents, notes and references (plus GIS layers and
  researched documents on the page). The Organization tab is the organization
  Context page's own body: the organization prompt, the saved notes (one-click
  delete) and the reference documents, with a link to the organization page.
  Users who cannot read the organization see no tab bar.
- These replace the "Add files to: Project / {organization}" switch and the
  combined "{organization} context" panel.

`DocumentsSectionUI` gains an optional `singleColumn` prop for narrow
containers.
