---
"turboplan-landing-page": patch
---

The landing app dropped dead code:
- 22 unused files and 27 unused dependencies.
- Its own boilerplate Playwright suite.
- The ESLint and Prettier setup (the repo uses Biome).
- The `dotenv` call in the root layout.
- The `NEXT_PUBLIC_CATALOG_BASE_URL` example variable.
