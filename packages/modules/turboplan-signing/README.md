# @wildfires-org/turboplan-signing

Document signing for TurboPlan projects, backed by [Documenso](https://documenso.com). Users request signatures on project documents, recipients sign through an embedded Documenso flow, and status updates come back via webhook.

## How It Works

1. A user requests signatures on a project document (parallel or sequential signing)
2. The server creates a Documenso envelope (`@documenso/sdk-typescript`) and emails recipients (`@wildfires-org/turboplan-mail`)
3. Recipients sign in an embedded view (`@documenso/embed-react`) using a per-recipient sign token
4. Documenso webhooks update recipient/request status; on completion the signed PDF is stored via `@wildfires-org/turboplan-upload`
5. Activity is recorded via `@wildfires-org/turboplan-timeline-records`

## Exports

- `./client` — `ProjectSigningPage`, `MySignaturesPage`, `RequestSignaturesDialog`, `SignDocumentModal`, `SignRequestFlow`, `SigningBanner`, `OrgSigningConfig` components; hooks (`useSigningRequests`, `useMyPendingSignatures`, `useSignToken`, …)
- `./server` — `signingRouter`, `signingWebhookRouter` (Hono), Documenso client helpers (`createEnvelope`, `getEnvelopeStatus`, `downloadSignedDocument`), signing-request queries, `generatePdfFromMarkdown`
- `./types` — `SigningRequest`, `SigningRecipient`, status/mode types
- `./pdf` — standalone `generatePdfFromMarkdown` (pdfkit-based markdown-to-PDF)

## Integration

Mounted in `apps/server` when the signing feature flag is enabled:

- `signingRouter` → `/api/signing-requests` (authenticated; create/list/cancel requests, sign tokens, completion)
- `signingWebhookRouter` → `/api/webhooks/signing` (public; authenticated via the `x-documenso-secret` header against the platform or per-organization webhook secret)

Per-organization Documenso configuration (API keys, webhook secrets) is managed through the org settings UI (`OrgSigningConfig`) and resolved server-side, falling back to the platform-wide credentials.

## Configuration

Environment variables (via `@wildfires-org/turboplan-env`):

- `DOCUMENSO_API_URL`
- `DOCUMENSO_API_KEY`
- `DOCUMENSO_WEBHOOK_SECRET`

Feature flag: `IS_SIGNING_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_SIGNING_PACKAGE_ENABLED` (`isSigningPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).
