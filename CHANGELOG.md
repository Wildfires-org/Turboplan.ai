# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning applies to the platform as a whole: every workspace package in this
monorepo is released at the same version.

## [Unreleased]

## [1.0.0] - 2026-09-09

First public release of TurboPlan — an extensible, AI-powered project workspace.

### Added

- **AI chat workspace** (`apps/turboplan`) — Next.js 15 App Router application
  combining an AI chat interface with project management. Model routing through
  OpenRouter with four configurable slots (primary, lite, image primary, image
  lite), resolved from database config → environment variable → default.
- **Hono API server** (`apps/server`) — the canonical backend for all business
  logic, running on Bun in development and Cloudflare Workers in production.
- **Landing page** (`apps/landing-page`) — marketing site with a public project
  catalog, documentation, and Stripe checkout entry points.
- **MCP server** (`apps/mcp-server`) — Model Context Protocol server on
  Cloudflare Workers, authenticated with personal access tokens, exposing the
  workspace as tools to AI agents.
- **Research agent** (`apps/research-agent`) — autonomous research agent built on
  the Claude Agent SDK.
- **Feature-flagged modules** — tasks and milestones with Gantt charts,
  documents, interactive maps, custom project fields, project context, timeline
  records, chat quick actions, Stripe billing, and Documenso-based document
  signing. Each is toggled per deployment via `IS_<MODULE>_PACKAGE_ENABLED`.
- **Role-based access control** (`packages/core/turboplan-rbac`) — Owner, Editor
  and Viewer roles inheriting down an Organization → Office → Project hierarchy,
  with Hono and Next.js middleware.
- **Authentication** — magic-link login with JWT sessions and cross-subdomain
  cookie support.
- **Branding override surface** — application name, logo and OG images isolated
  behind one config module and asset directory per app, with `.gitattributes`
  `merge=ours` markers so forks keep their identity across upstream merges.
- **Optional Sentry integration** — no-ops entirely when its DSN is unset;
  includes a PII scrub that strips auth headers and redacts magic-link tokens
  and presigned-URL signatures.
- **Deployment tooling** — GitHub Actions workflows and scripts for Cloudflare
  Workers, with per-pull-request preview environments and automatic cleanup.
- **End-to-end test suite** (`e2e/`) — Playwright specs with page objects and
  fixtures.
- Apache License 2.0, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md` and
  `CODE_OF_CONDUCT.md`.

[Unreleased]: https://github.com/Wildfires-org/turboplan/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Wildfires-org/turboplan/releases/tag/v1.0.0
