# @wildfires-org/turboplan-search

Cross-entity fuzzy search for TurboPlan — one search box over organizations, offices, projects, and templates. Powered by PostgreSQL's `pg_trgm` extension (substring matching via `ILIKE`, typo tolerance via the `%` operator, and `word_similarity`-based ranking) — not tsvector full-text search.

## Exports

| Path | Contents |
| --- | --- |
| `/client` | `OmniSearch` component, primitives, `SearchResults` / `SearchResultItem`, `useOmniSearch` hook |
| `/server` | `searchRouter` (Hono) and `searchEntities()` query |
| `/types` | `SearchableEntityType`, `ENTITY_TYPE_LABELS`, `BreadcrumbItem`, result types |

## Server

`searchRouter` exposes a single public endpoint (`GET /?q=...&limit=...`) that runs the cross-entity search and returns results with hierarchy breadcrumbs. It is mounted at `/api/search` in `apps/server` (no authentication required).

```typescript
import { searchRouter } from "@wildfires-org/turboplan-search/server";

apiRouter.route("/api/search", searchRouter);
```

Only publicly visible entities are searched: active government organizations and their active offices, plus active public (non-template) projects and public templates.

## Client

```tsx
import { OmniSearch } from "@wildfires-org/turboplan-search/client";

<OmniSearch />
```

`useOmniSearch` wraps the search endpoint with SWR (pass it an already-debounced query) if you need a custom UI on top of the primitives.

## Searchable Entities

`organization`, `office`, `project`, `template` — see `SearchableEntityType` in `/types`.
