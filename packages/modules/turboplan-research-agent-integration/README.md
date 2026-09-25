# @wildfires-org/turboplan-research-agent-integration

Integrates TurboPlan with an external research agent service that runs long-running, autonomous research jobs for projects. Results stream back via webhooks and are shown in a research panel where users can review and save them to the project.

Two agent skills are supported:

- **Project bootstrapper** — researches a new project and produces documents, milestones/tasks, custom fields, context entries, timeline events, and chat suggestions, each saveable into the corresponding TurboPlan module
- **Project cataloger** — catalog-building runs, with an admin router for inspection

## Exports

- `./client` — `ResearchPanel` (plus header/footer and supporting components) and hooks (`useResearchAgentMessages`, `useResearchAgentStatus`, `useSaveToProject`, …)
- `./server` — proxy routers (`bootstrapperRouter`, `catalogerRouter`, `catalogerAdminRouter`), webhook routers (`bootstrapperWebhookRouter`, `catalogerWebhookRouter`), `getResearchAgentClient` (HTTP client for the external service), `getResearchAgentContextForChat`, `webhookLoggerMiddleware`, Zod schemas
- `./types` — message types (`ResearchAgentMessage`, per-section payloads like `DocumentsMessageData`, `MilestonesMessageData`), `ResearchAgentStatus`, `ResearchAgentChat`

## Integration

Mounted in `apps/server` when the feature flag is enabled:

- `bootstrapperRouter` → `/api/ai/research-agent/bootstrapper` (authenticated, RBAC-checked)
- `catalogerRouter` and `catalogerAdminRouter` → `/api/admin/cataloger` (platform admins only, via `adminMiddleware`). Never mount the cataloger outside `/api/admin`: runs create GOVERNMENT organizations and public template projects.
- Webhook routers (per-run `x-webhook-secret` auth, no shared API key) → `/api/webhooks/research-agent/bootstrapper` and `/api/webhooks/research-agent/cataloger`. Each router applies `webhookLoggerMiddleware` itself, immediately after its secret check — never before it.

## Configuration

Environment variables (via `@wildfires-org/turboplan-env`):

- `RESEARCH_AGENT_SERVICE_URL` — base URL of the external agent service
- `RESEARCH_AGENT_SERVICE_API_KEY` — sent as `x-api-key` on agent-run requests
- `NEXT_PUBLIC_RESEARCH_AGENT_POLLING_INTERVAL` — client polling interval in ms (optional, defaults to 5000)

Feature flag: `IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` (`isResearchAgentPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).

## Notes

Saving results reuses the other feature modules (`turboplan-documents`, `turboplan-tasks` schemas, `turboplan-fields`, `turboplan-project-context`, `turboplan-timeline-records`), so their feature flags determine which sections can be persisted.
