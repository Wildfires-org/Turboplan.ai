---
"turboplan": minor
"@wildfires-org/turboplan-utils": patch
"@wildfires-org/turboplan-research-agent-integration": patch
---

Restyle the AI chat, the office templates page and the profile page in the glass
style.

- Chat: user messages in glass bubbles, assistant replies on the page ground
  with readable markdown (tables and code blocks now have padding), glass tool
  and document cards, a glass composer and research pane, and skeleton loading
  states. Opening a chat no longer shifts the layout (the research pane used to
  animate open on load).
- Templates: the office page frame with search, glass template cards and an
  empty state.
- Profile: page title, tabs, glass sections with inset inputs, token table
  chips and a clearer revoke action, and a styled interface-scale slider.
- Suggestion pills are glass everywhere they appear.
