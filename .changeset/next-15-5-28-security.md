---
"turboplan": patch
"turboplan-landing-page": patch
---

Next.js is upgraded from 15.5.25 to 15.5.28, which fixes a high-severity
Server Actions denial of service (GHSA-p3m5-59mp-jv5r) that affected the web
app, and a critical sharp RCE in Image Optimization (GHSA-2464-fhr4-w9xw).
The workers optimize images through the Cloudflare Images binding, so that RCE
did not reach production. Next's own sharp is forced to 0.35.5 or later. The
workspace packages' `next` peer floor is raised to 15.5.28 so none of them
resolves an older copy.

`@opennextjs/cloudflare` moves from 1.19.4 to the 1.20 line, which fixes
encoded paths skipping middleware under cache interception
(GHSA-2vc4-c4r6-p6v6); the landing page enables cache interception. 1.20
requires wrangler 4.148 or newer, so wrangler moves from 4.94 to 4.151 for
every Worker. OpenNext 1.20.13 also drops the date-based check that has
failed every Next 15 build since 2026-10-21 ("Next.js version 15.x.x is not
supported by the Next.js team"), which is what unblocks web and landing
deploys.
