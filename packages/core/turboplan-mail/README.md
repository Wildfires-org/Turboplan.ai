# @wildfires-org/turboplan-mail

Email services and templates for TurboPlan using React Email.

## Features

- **Provider-agnostic design** – Swap email providers behind a single interface
- **React Email templates** – Type-safe, reusable email components
- **Built-in providers** – Resend (production), Ethereal (development/testing), Noop (no provider configured)
- **High-level API** – `MailService` convenience methods for common email types

## Exports

| Path | Contents |
| --- | --- |
| `.` | All exports (providers, services, templates, types) |
| `/types` | TypeScript interfaces (`MailProvider`, `SendEmailOptions`, ...) |
| `/providers` | `ResendProvider`, `EtherealProvider`, `NoopProvider`, `createMailProvider()` |
| `/services` | `MailService`, `createMailService()` |
| `/templates` | React Email template components |
| `/server` | `getMailService()` singleton and Hono routers (`emailRouter`, `internalEmailRouter`) |

## Quick Start

In the backend, use the pre-configured singleton — it picks a provider from the environment (Resend if `RESEND_API_KEY` is set, Ethereal if `ETHEREAL_USER`/`ETHEREAL_PASS` are set, otherwise Noop which silently skips sending):

```typescript
import { getMailService } from "@wildfires-org/turboplan-mail/server";

const mailService = getMailService();

await mailService.sendMagicLinkEmail({
  to: "user@example.com",
  magicLinkUrl: "https://app.your-domain.com/verify?token=xxx",
  type: "verification", // or "login"
});

await mailService.sendInvitationEmail({
  to: "invitee@example.com",
  inviteeEmail: "invitee@example.com",
  inviterName: "Jane Doe",
  entityName: "Q1 Planning",
  entityType: "project", // "organization" | "office" | "project"
  inviteUrl: "https://app.your-domain.com/invite/abc123",
});
```

Or wire up a provider manually:

```typescript
import {
  createMailProvider,
  createMailService,
} from "@wildfires-org/turboplan-mail";

const provider = createMailProvider("resend", {
  apiKey: "re_xxxxx",
  defaultFrom: "noreply@yourdomain.com",
});
const mailService = createMailService(provider);
```

## MailService Methods

- `sendMagicLinkEmail()` – Authentication (verification or login)
- `sendInvitationEmail()` – Invite a user to an organization, office, or project
- `sendMemberAddedEmail()` – Notify a user they were added to an organization, office, or project
- `sendProjectInvitationEmail()` – Project-specific invitation
- `sendTaskAssignmentEmail()` – Task assignment notification
- `sendSubmissionAcceptanceEmail()` / `sendSubmissionRejectionEmail()` – Project submission decisions
- `sendSigningRequestEmail()` – Document signing request
- `sendPaymentFailedEmail()` – Billing payment failure notification
- `sendDiscountEndingEmail()` – Billing discount expiry notification
- `sendUsageAlertEmail()` – Billing usage threshold alert
- `sendEmail()` – Raw passthrough to the provider

## Providers

### ResendProvider

Production email sending via [Resend](https://resend.com).

### EtherealProvider

Development/testing provider that sends to [Ethereal](https://ethereal.email) fake SMTP. Emails are captured and viewable in the Ethereal inbox.

### NoopProvider

Used when no provider is configured — send calls succeed but nothing is delivered.

## Templates

Available templates (exported from `/templates`):

- `MagicLinkEmail`, `InvitationEmail`, `MemberAddedEmail`, `ProjectInvitationEmail`, `TaskAssignmentEmail`, `SigningRequestEmail`, `SubmissionAcceptanceEmail`, `SubmissionRejectionEmail`, `PaymentFailedEmail`, `DiscountEndingEmail`, `UsageAlertEmail`

Use a template directly with a provider:

```typescript
import { MagicLinkEmail } from "@wildfires-org/turboplan-mail/templates";

await provider.sendEmail({
  to: "user@example.com",
  subject: "Sign in",
  react: MagicLinkEmail({ magicLinkUrl: "https://...", type: "login" }),
});
```

Create custom templates with the shared layout:

```tsx
import { BaseLayout } from "@wildfires-org/turboplan-mail/templates";
import { Button, Heading, Text } from "@react-email/components";

export const MyCustomEmail = ({ name }: { name: string }) => (
  <BaseLayout preview={`Hello ${name}`}>
    <Heading>Hello {name}!</Heading>
    <Text>This is a custom email.</Text>
    <Button href="https://example.com">Click Here</Button>
  </BaseLayout>
);
```

## Adding New Providers

Implement the `MailProvider` interface from `/types` and add it to the factory in `src/providers/mail-provider.ts`.

## Environment Variables

Read via `@wildfires-org/turboplan-env` in the backend:

| Variable | Required | Description |
| --- | --- | --- |
| `RESEND_API_KEY` | No | Resend API key — enables the Resend provider |
| `RESEND_FROM_EMAIL` | No | Default sender address |
| `MAIL_REPLY_TO_EMAIL` | No | Default reply-to address |
| `ETHEREAL_USER` / `ETHEREAL_PASS` | No | Ethereal credentials — enables the Ethereal provider |

If none are set, the Noop provider is used.
