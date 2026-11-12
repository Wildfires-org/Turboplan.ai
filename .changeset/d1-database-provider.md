---
"turboplan": minor
"turboplan-server": minor
"@wildfires-org/turboplan-db": minor
"@wildfires-org/turboplan-env": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-search": minor
---

TurboPlan can now run on Cloudflare D1 (SQLite) instead of PostgreSQL. Set
`DB_PROVIDER=d1` and `POSTGRES_URL` is no longer required. The Workers use a D1
binding named `DB`. Node processes use a local SQLite file
(`D1_LOCAL_PATH`) or the D1 HTTP API (`CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`,
`CLOUDFLARE_API_TOKEN`); migrations and seeds use the HTTP API. PostgreSQL stays
the default, and nothing changes for deployments that leave `DB_PROVIDER`
unset.

The schema and the queries are shared. A drizzle dialect translates the
generated SQL for SQLite and maps its values. The few Postgres-only expressions
branch at the call site: jsonb containment, trigram search ranking, advisory
locks, `date_trunc`, `btrim` and `left`. The SQLite schema lives in
`packages/core/turboplan-db/src/migrations-d1/`, in the layout
`wrangler d1 migrations apply` reads. `pnpm db:migrate` applies it on D1, and
`pnpm --filter @wildfires-org/turboplan-db d1:generate <name>` writes the next
one after a schema change. A unit test fails while it is out of date.

On D1, transactions are not atomic. Maps (PostGIS) are not supported. Search
matches substrings instead of trigrams. See "Database providers" in
CONFIGURATION.md.
