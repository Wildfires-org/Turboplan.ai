---
"turboplan": patch
---

Signed-out visitors are now sent to login from every app page, returning to where they were going after sign-in. The middleware never saw the session (it read a different cookie name than `auth.ts` writes) and next-auth ignored its `authorized()` rule, so only pages with their own check were protected: `/profile` showed a signed-out visitor an empty form. API routes, `/invite`, the Sentry tunnel and static files are unaffected.
