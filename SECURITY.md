# Security Policy

## Supported Versions

TurboPlan is released as a versioned snapshot of the platform. Security fixes are
applied to the latest release on `main`.

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Report privately through either channel:

1. **GitHub Security Advisories** (preferred) — open a private report from the
   repository's **Security → Report a vulnerability** tab. This keeps the
   discussion private until a fix is released.
2. **Email** — `security@wildfires.org`

Please include as much of the following as you can:

- The type of issue (e.g. authentication bypass, IDOR, SQL injection, SSRF, XSS)
- Full paths of the source files related to the issue
- The affected app or package (`apps/turboplan`, `packages/core/turboplan-rbac`, …)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code, if you have it
- The impact, including how an attacker might exploit it

Reports in English are preferred.

## What to Expect

- **Acknowledgement** within 5 business days.
- **Assessment and severity triage** within 10 business days.
- **Fix and disclosure** — we aim to ship a fix within 90 days of the initial
  report, coordinating the disclosure timeline with you.

Triage is best-effort: TurboPlan is maintained alongside a commercial product,
and the team is small. We will tell you honestly if a report will take longer.

## Scope

In scope — the code in this repository:

- Authentication and session handling (`packages/core/turboplan-auth`, magic-link
  flow, JWT sessions, cookie scoping)
- Authorization and RBAC (`packages/core/turboplan-rbac`) — including privilege
  escalation and horizontal access (IDOR) between organizations, offices and
  projects
- The MCP server's PAT authentication and per-tool permission checks
  (`apps/mcp-server`)
- Injection of any kind, SSRF, and unsafe deserialization
- Secret handling and the encryption helpers in `packages/core/turboplan-env`
- Public API routes (`packages/core/turboplan-public`)

Out of scope:

- Vulnerabilities in third-party dependencies without a demonstrated exploit path
  through this codebase — report those upstream
- Findings that require a self-hosted operator to have already misconfigured
  their own deployment (e.g. a leaked `AUTH_SECRET`, a database exposed to the
  internet)
- Missing security headers or rate limits with no demonstrated impact
- Social engineering, physical attacks, and denial of service
- Automated scanner output submitted without a working proof of concept

## Deploying TurboPlan Safely

If you self-host, the following are your responsibility and are not defects in
this repository:

- Generate a strong, unique value per environment for each of `AUTH_SECRET`,
  `INTERNAL_API_SECRET`, `JWT_SIGNING_SECRET` and `ENCRYPTION_KEY`. They are
  deliberately separate so one leak does not compromise the others — never
  reuse a single value across them, and never reuse the values from
  `.env.example`. `AUTH_SECRET`, `INTERNAL_API_SECRET` and `JWT_SIGNING_SECRET`
  must be identical across the web app and the API server; rotating
  `ENCRYPTION_KEY` makes existing encrypted values unreadable.
- Set `ALLOWED_ORIGINS` to your real origins — do not leave it permissive.
- Scope `PRODUCTION_COOKIE_DOMAIN` to a domain you control.
- Keep `POSTGRES_URL` on a private network and enable TLS.
- Rotate `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `STRIPE_*` and `R2_*`
  credentials if they are ever committed or logged.
- Review the `IS_*_PACKAGE_ENABLED` feature flags — only enable modules you
  intend to expose.

## Recognition

We are happy to credit reporters in the release notes for the fix. Tell us how
you would like to be named, or ask to stay anonymous.
