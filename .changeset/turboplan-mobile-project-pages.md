---
"turboplan": patch
"@wildfires-org/turboplan-workspace": patch
"@wildfires-org/turboplan-tasks": patch
"@wildfires-org/turboplan-fields": patch
"@wildfires-org/turboplan-documents": patch
"@wildfires-org/turboplan-project-context": patch
---

Project pages on phones:

- The project header shows a 3-line description on the overview and none on
  sub-views, with a shorter cover there, so each sub-view's content starts on
  the first screen.
- The header breadcrumb shows only the current page instead of a trail cut
  off at the screen edge.
- Members: the table no longer squeezes the user column to nothing (the
  tasks and status columns fold away, status shows next to the name), the
  search and Invite button fit one row and the filter chips scroll in one row.
- Tasks: the Gantt search fills the toolbar row and the task column fits the
  screen, so long titles end in an ellipsis.
- Fields stack the label above the value, and their row menu is visible on
  touch screens, which have no hover.
- Timeline and context cards pin their actions to the corner so the text gets
  the full card width.
- The chat's setup bar shows only the current step.
- The documents upload strip is its own dashed box and reads "Browse files"
  on phones, where there is nothing to drag.
