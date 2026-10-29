---
"turboplan": patch
"turboplan-landing-page": patch
---

The web app and landing Workers no longer log three unhandled
`WebAssembly.compile()` errors on every cold start: Sentry's build-time webpack
plugin is kept out of the server bundle.
