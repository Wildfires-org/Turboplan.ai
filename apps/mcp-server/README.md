# TurboPlan MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server (`turboplan-catalog`) that exposes TurboPlan workspace data — organizations, offices, projects, fields, context, milestones, tasks, timeline, documents, members, and comments — as MCP tools for AI agents (Claude Desktop, Claude Code, Cursor, and others).

Runs on **Cloudflare Workers** using `@modelcontextprotocol/sdk` with the Streamable HTTP transport. The Worker is stateless: every request creates a fresh `McpServer` instance scoped to the authenticated user, so every tool call is bound to that user's permissions. No SSE, no stdio — Workers only support Streamable HTTP.

## Quickstart: connect a client

Point your MCP client at the deployed URL (`https://<worker-host>/mcp`) with a Bearer [Personal Access Token](#authentication).

**Clients with native remote-MCP support** (e.g. Claude Code):

```bash
claude mcp add --transport http turboplan https://<worker-host>/mcp \
  --header "Authorization: Bearer tc_pat_xxxxxxxx"
```

Or via a client config that accepts a remote URL + headers:

```json
{
  "mcpServers": {
    "turboplan-catalog": {
      "url": "https://<worker-host>/mcp",
      "headers": { "Authorization": "Bearer tc_pat_xxxxxxxx" }
    }
  }
}
```

**Clients that only speak stdio** (e.g. Claude Desktop today) — bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "turboplan": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<worker-host>/mcp",
        "--header",
        "Authorization: Bearer tc_pat_xxxxxxxx"
      ]
    }
  }
}
```

Smoke-test the deployment without auth:

```bash
curl https://<worker-host>/health
# {"status":"ok","name":"turboplan-catalog","version":"0.1.0"}
```

## Authentication

Requests to `/mcp` require a Personal Access Token (PAT) as a Bearer token:

```
Authorization: Bearer tc_pat_...
```

Create a PAT in the TurboPlan web app under **Profile → Access Tokens** (shown once on creation). The Worker never stores the plaintext token — it SHA-256 hashes the presented token, looks the hash up in the database, and updates the token's `lastUsedAt`. Tools run as **you**, using your TurboPlan roles; treat a PAT like a password.

## Tool catalog

All 60 tools follow a `verb_noun` naming convention.

| Domain | Tools |
| ------ | ----- |
| Organizations | `list_my_organizations`, `get_organization`, `search_organizations`, `create_organization`, `update_organization`, `upload_organization_logo_from_url` |
| Offices | `list_offices`, `get_office`, `create_office`, `update_office` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` |
| Fields | `list_project_fields`, `add_project_field`, `add_project_fields`, `update_project_field`, `delete_project_field` |
| Context | `list_project_context`, `add_project_context`, `add_project_context_entries`, `update_project_context`, `delete_project_context` |
| Milestones | `list_milestones`, `get_milestone`, `create_milestone`, `update_milestone`, `delete_milestone` |
| Tasks | `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_task`, `update_task_status`, `move_task` |
| Timeline | `get_timeline`, `get_timeline_stats`, `create_timeline_event`, `create_timeline_events` |
| Documents | `list_project_documents`, `upload_document_from_url`, `upload_documents_from_urls`, `upload_document_from_content`, `delete_project_document` |
| Cover images | `create_project_cover_image`, `create_office_cover_image`, `create_organization_cover_image` |
| Members | `list_project_members`, `add_project_member`, `update_member_role`, `remove_project_member` |
| Comments | `list_comments`, `create_comment`, `update_comment_visibility`, `delete_comment` |
| Summary | `get_project_summary` |
| Capabilities | `list_my_permissions`, `check_entity_permission` |
| Server | `ping` (identity + status) |

Full input schemas are advertised by the server — list them from your client after connecting.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Health check → `{ status, name, version }` |
| `POST` | `/mcp` | Bearer PAT | MCP Streamable HTTP endpoint |

`/mcp` request requirements and error responses:

| Condition | Status | Body |
| --------- | ------ | ---- |
| Missing / malformed / unknown `Authorization` | `401` | `{ "error": "Missing authentication" \| "Invalid token format" \| "Invalid token" }` |
| Non-`POST` method | `405` | `{ "error": "Method not allowed" }` |
| Missing/wrong `Content-Type` (must be `application/json`) | `415` | `{ "error": "Content-Type must be application/json" }` |
| Body larger than 1 MiB (`MAX_BODY_SIZE`) | `413` | `{ "error": "Request body too large" }` |

## Security model

The server is designed to be safe to expose to autonomous agents:

- **Per-user isolation** — every request is bound to the PAT's user; there is no ambient admin identity.
- **No platform-admin powers over a PAT** — even a platform admin's PAT gets no admin bypass. `create_organization` always returns `Access denied.`, and `update_organization` rejects any `type` / `status` change; do those in the web app.
- **RBAC on every tool** — reads require `READ`, mutations require `UPDATE`, member/role operations require `MANAGE_MEMBERS`.
- **Uniform errors — no existence leaks** — a missing entity and a denied permission both return the exact string `Access denied.`, so a caller cannot probe which IDs exist.
- **Cross-entity (IDOR) checks** — when a tool links entities, it verifies the target belongs to the same project before writing.
- **Last-owner protection** — removing or demoting the final owner of an entity is rejected inside a transaction.

Every mutating handler also writes a timeline record (`{ source: "mcp", actor: user.actor }`).

## Rate limiting

Configured in `wrangler.toml` (Workers rate-limiting bindings):

| Limiter | Scope | Limit |
| --- | --- | --- |
| `RATE_LIMITER_GLOBAL` | Per IP, pre-auth | 200/min |
| `RATE_LIMITER_READ` | Per user, read tools | 60/min |
| `RATE_LIMITER_WRITE` | Per user, write tools | 30/min |

A tool counts as a write when its name starts with `create_`, `update_`, `delete_`, `upload_`, `add_`, `move_`, or `remove_` (see `WRITE_TOOL_PREFIXES` in `src/index.ts`).

## Structure

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Worker entry — PAT auth, rate limiting, method/content-type guards, env bridging, transport |
| `src/server.ts` | `createServer(user, storage)` — registers all tool modules |
| `src/tools/` | One file per domain (organizations, offices, projects, fields, context, milestones, tasks, timeline, documents, cover-image, members, comments, summary, capabilities) |
| `src/utils/` | Shared permission checks, Zod validation, DB queries, types |
| `wrangler.toml` | Cloudflare config — rate limiters, compat flags, custom build |
| `build.mjs` | esbuild bundling (aliases `zod` → `zod/v3` for workerd compatibility) |

## Development

```bash
# From the monorepo root
pnpm install
pnpm build:packages

pnpm --filter @wildfires-org/turboplan-mcp-server dev        # wrangler dev
pnpm --filter @wildfires-org/turboplan-mcp-server typecheck
pnpm --filter @wildfires-org/turboplan-mcp-server test       # node --test unit tests
```

Local variables go in `.dev.vars`, **not** `.env` — `wrangler dev` reads only
that file, and `wrangler.toml` declares no `[vars]` block, so everything comes
from there:

```bash
cp apps/mcp-server/.dev.vars.example apps/mcp-server/.dev.vars
```

Every variable is documented in that file. The minimum to boot is
`POSTGRES_URL`, `AUTH_SECRET`, `TURBOPLAN_URL` and the five required feature
flags; R2 and `OPENROUTER_API_KEY` are only needed for the document-upload and
cover-image tools respectively.

To call the server, mint a Personal Access Token (`tc_pat_...`) from the web app
running against the **same** database — this server authenticates by PAT hash
lookup, not by session cookie or API JWT.

## Environment variables

Workers have no ambient `process.env`; `src/index.ts` bridges Worker vars/secrets onto `process.env` per request (`ENV_BRIDGE_KEYS`). Key variables:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_URL` | PostgreSQL connection string (secret) |
| `AUTH_SECRET` | Shared auth secret (secret) |
| `TURBOPLAN_URL` | Web app URL |
| `R2_*` | Cloudflare R2 storage credentials for document uploads |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_IMAGE_*` | Cover-image generation |
| `IS_*_PACKAGE_ENABLED` | Feature flags mirroring the API server |

Adding a new env var requires updating the `Env` type and `ENV_BRIDGE_KEYS` in `src/index.ts`, plus `scripts/deploy-mcp.sh`.

## Deploy

From the repo root:

```bash
./scripts/deploy-mcp.sh <production|staging|preview> [pr-number]
```

`pr-number` is required for `preview`. Requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the secrets listed in the script header (`POSTGRES_URL`, `AUTH_SECRET`, `R2_*`, `OPENROUTER_API_KEY`).

## Adding a tool

1. Add the handler to a file in `src/tools/` (or create `src/tools/{domain}.ts` exporting `register{Domain}Tools`).
2. Follow the standard sequence: validate input (`validateToolInput` + Zod) → `assertEntityExists` → `assertPermission` → business logic → `createTimelineRecord` for mutations → return JSON content.
3. Register the module in `src/server.ts`.
4. If it's a write tool, make sure its name prefix matches `WRITE_TOOL_PREFIXES` so it hits the write rate limiter.
5. Run typecheck.
6. New env vars → add to the `Env` type and `ENV_BRIDGE_KEYS` in `src/index.ts`, and to `scripts/deploy-mcp.sh`.
