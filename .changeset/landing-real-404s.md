---
"turboplan-landing-page": patch
---

Unknown landing-page URLs now return a real 404 status. Before, `/docs/*` and
the public catalog under `/projects/*` answered 200 with a noindex "not found"
page (a soft 404). The root layout no longer wraps every page in a Suspense
boundary. That boundary let the 200 status go out before a page could call
`notFound()`. The navbar's catalog search and the signup modal read search
params, so each now has its own boundary instead.
