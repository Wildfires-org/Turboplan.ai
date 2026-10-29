---
"turboplan": patch
---

The "View System Prompt" and document prompt debug buttons now show only in
local development, the same place their `/api/debug/*` endpoints answer. On
develop, PR previews and production they used to show and then fail with
"Failed to fetch system prompt."
