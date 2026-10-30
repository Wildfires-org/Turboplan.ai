---
"turboplan": patch
"turboplan-landing-page": patch
---

Upgrade `@opennextjs/cloudflare` to 1.20.13 (`@opennextjs/aws` 4.1.12). Older
releases refuse to build any Next.js major more than two years after its
release, so every OpenNext build of the web app and landing page on Next 15
has failed since 2026-10-21. Both build again without
`--dangerouslyUseUnsupportedNextVersion`.
