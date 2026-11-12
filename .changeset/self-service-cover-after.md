---
"turboplan": patch
---

A signed-in visitor who starts a project from the landing or entry-page prompt
now gets a generated cover image on Cloudflare Workers. The cover request was
fired without being awaited, and Workers cancels such promises once the
response is sent, so it never reached the API; it now runs through Next's
`after()`.
