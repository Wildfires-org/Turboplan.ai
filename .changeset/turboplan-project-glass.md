---
"turboplan": minor
"turboplan-landing-page": patch
"@wildfires-org/turboplan-utils": patch
"@wildfires-org/turboplan-tasks": minor
"@wildfires-org/turboplan-fields": patch
"@wildfires-org/turboplan-map": patch
"@wildfires-org/turboplan-documents": patch
"@wildfires-org/turboplan-project-context": patch
"@wildfires-org/turboplan-research-agent-integration": patch
"@wildfires-org/turboplan-gantt-task": patch
---

Restyle the project view and all its sub-pages (overview, tasks, map, timeline,
comments, documents, context, members, chat) in the glass style.

- Project pages share one frame: breadcrumbs, the office-style banner header
  card and glass panels, with skeleton loading states that render the real
  header immediately.
- Tasks: segmented view switcher, status chips with icons instead of emoji,
  grouped milestone rows, aligned dates and brand-coloured Gantt bars.
- Map: rounded map frame, glass zoom and layer controls; the Map Type and
  Layers menus no longer open on top of their own buttons.
- Sidebar: the nested nav guide line no longer crosses the active item, the
  chat "+" button is readable, and the loading skeleton mirrors the real nav.
- New default project cover photo (forest and lake) replaces the pastel
  placeholder, also in the landing page showcase.
