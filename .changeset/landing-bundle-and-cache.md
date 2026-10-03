---
"turboplan-landing-page": minor
---

Smaller, better-cached marketing pages:

- Content-hashed `/_next/static/*` assets are now served with
  `Cache-Control: public, max-age=31536000, immutable` through
  `public/_headers`. They were `max-age=0`.
- The root layout no longer reads the session or the UI-scale cookie. Either
  read made every page dynamic and uncacheable. The navbar gets the session
  from a new `/api/session` route after hydration and keeps "Sign In" hidden
  until it knows. The app's UI-scale cookie still applies after hydration.
- OpenNext serves prerendered pages from Workers static assets (a read-only
  incremental cache). Before, the default no-op cache rendered every page on
  every request.
- The home hero is part of the static HTML. Only a tiny null-rendering
  component reads `?projectDescription` and `?tryIt`. Before, a page-level
  Suspense around the whole home page kept it out of the server-rendered HTML.
- The hero's entrance animation is CSS instead of framer-motion's
  `whileInView`, so the headline paints without waiting for JavaScript.
