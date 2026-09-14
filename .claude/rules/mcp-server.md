# MCP Server

## Architecture

The MCP server lives at `apps/mcp-server/` and runs on **Cloudflare Workers** (stateless per-request). Uses `@modelcontextprotocol/sdk` with Streamable HTTP transport. Each request creates a fresh `McpServer` instance with authenticated user context.

Authentication via **Personal Access Tokens (PATs)** — `tc_pat_` prefixed, validated by hash lookup against DB.

## Key Files

| Path | Purpose |
|------|---------|
| `src/index.ts` | Worker entry — PAT auth, rate limiting, env bridging, transport |
| `src/server.ts` | `createServer(user)` — registers all tool modules |
| `src/tools/*.ts` | Tool files — one per domain |
| `src/utils/permissions.ts` | `assertPermission()`, `assertEntityExists()` |
| `src/utils/validation.ts` | Shared Zod schemas + `validateToolInput()` |
| `src/utils/queries.ts` | Shared DB helpers (`projectExists()`) |
| `src/utils/types.ts` | `McpUserContext`, `McpToolResult` |
| `wrangler.toml` | Cloudflare config — rate limiters, compat flags |
| `scripts/deploy-mcp.sh` (repo root) | Deploy script — vars, secrets |

## Tool Implementation Pattern

Every tool handler follows this exact sequence:

1. **Validate input** — `validateToolInput()` with Zod schema
2. **Check entity exists** — `assertEntityExists()` returns `"Access denied."` (never "not found")
3. **Check RBAC** — `assertPermission()` with appropriate `Action`
4. **Business logic** — service calls or direct Drizzle queries
5. **Timeline record** — `createTimelineRecord()` for all mutations with `{ source: "mcp", actor: user.actor }`
6. **Return JSON** — `{ content: [{ type: "text" as const, text: JSON.stringify(...) }] }`

All handlers wrapped in `runWithWorkerConnection()` for DB connection lifecycle.

## Security Rules

- **Uniform errors** — Entity not found and permission denied both return `"Access denied."`. Never reveal entity existence.
- **RBAC on every tool** — `READ` for queries, `UPDATE` for mutations, `MANAGE_MEMBERS` for member/role ops.
- **Cross-entity validation** — When linking entities (tasks→milestones, comments→projects), verify target belongs to same project. Prevents IDOR.
- **Last-owner protection** — Demoting/removing owners uses transaction + `ensureNotLastOwner()`.
- **Privilege escalation guard** — Sensitive fields (`isPublic`, `isTemplate`, org `type`/`status`) require `MANAGE_MEMBERS`, not `UPDATE`.

## Naming & Rate Limiting

Tool names use `verb_noun` format. Name prefix determines rate limiter bucket:
- Write: `create_*`, `update_*`, `delete_*`, `upload_*`, `add_*`, `move_*`, `remove_*` → `RATE_LIMITER_WRITE` (30/min)
- Read: everything else → `RATE_LIMITER_READ` (60/min)
- Pre-auth: `RATE_LIMITER_GLOBAL` (200/min per IP)

## Shared Helpers

Use these — do not duplicate:
- `projectExists()` from `utils/queries.ts`
- `assertEntityExists()`, `assertPermission()` from `utils/permissions.ts`
- `entityIdSchema`, `nameSchema`, `descriptionSchema`, `validateToolInput()` from `utils/validation.ts`

## Adding a New Tool

1. Add to existing file in `src/tools/` or create new `src/tools/{domain}.ts`
2. Export `register{Domain}Tools(server: McpServer, user: McpUserContext)`
3. Register in `src/server.ts`
4. If write tool, verify name prefix matches `WRITE_TOOL_PREFIXES` in `index.ts`
5. Run `pnpm --filter @wildfires-org/turboplan-mcp-server typecheck`
6. New env vars → update `Env` type + `ENV_BRIDGE_KEYS` in `index.ts` + `scripts/deploy-mcp.sh`

## Key Conventions

- `documentId` = `projectId` in tasks/milestones schema — pass both when creating milestones
- Services (`MilestoneService`, `TaskService`) instantiated once per `register*Tools()` call
- `MilestoneService` requires `setTaskRepository()` called after construction
- Document uploads use Cloudflare R2 (`R2_*` env vars bridged in `index.ts`)
- No SSE, no stdio in production — Workers only support Streamable HTTP
