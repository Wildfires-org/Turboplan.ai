---
"turboplan": patch
---

Fix the project chat not filling the window when the interface scale is below
100% (including the 93.75% default). Its height was an inline
`calc(100vh - 64px)`, which the interface-scale viewport correction does not
reach, so at 80% the chat ended about a fifth of the way up the screen. The
admin prompts split view had the same issue.
