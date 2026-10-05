---
"turboplan": patch
"turboplan-landing-page": patch
---

PostHog no longer receives invite tokens. An invite link carries its token in
the path (`/invite/<token>`), and the login page hands it back through
`?callbackUrl=/invite/<token>`; neither was redacted. The URL sanitizers now
redact the invite path segment (raw or URL-encoded) and `callbackUrl` /
`redirectTo` parameters.
