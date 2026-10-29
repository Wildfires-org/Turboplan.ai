---
"turboplan-landing-page": patch
---

Public project and template pages no longer read the session cookie while
rendering, which made every one of them dynamic, and fetch their record once
per request instead of once for the page and again for its metadata. The comment
box and the "Use template" button read the session in the browser instead.
