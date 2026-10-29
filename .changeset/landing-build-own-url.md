---
"turboplan-landing-page": patch
---

The landing build and deploy now get the site's own origin
(`NEXT_PUBLIC_LANDING_URL`): `PRODUCTION_LANDING_DOMAIN` on `main`, the
`workers.dev` landing Worker otherwise. Without it `metadataBase` fell back to
`http://localhost:3000`, so social card image URLs pointed at localhost.
