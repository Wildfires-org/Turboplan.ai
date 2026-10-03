---
"turboplan-landing-page": patch
---

The landing page's middleware now runs. It sat at the app root, which Next.js
ignores when the app uses a `src/` directory, so the `/ingest` proxy never
stripped cookies before forwarding and CORS preflight requests were never
answered by it. It now lives at `src/middleware.ts`.
