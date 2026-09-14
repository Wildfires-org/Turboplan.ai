import { getApiEnv } from "@wildfires-org/turboplan-env";

import { createMailProvider, type ProviderType } from "../providers";
import type { EtherealConfig } from "../providers/ethereal-provider";
import { createMailService, type MailService } from "../services";
import type { MailConfig } from "../types";

let mailServiceInstance: MailService | null = null;

/**
 * Determine which mail provider to use based on environment
 * - If RESEND_API_KEY is set → use Resend (production)
 * - If ETHEREAL_USER and ETHEREAL_PASS are set → use Ethereal (dev/e2e testing)
 * - Otherwise → use Noop (silently skip email sending)
 */
function getProviderType(): ProviderType {
  const env = getApiEnv();

  if (env.RESEND_API_KEY) {
    return "resend";
  }

  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    return "ethereal";
  }

  return "noop";
}

/**
 * Get or create the singleton mail service instance
 * - Resend: Production email sending
 * - Ethereal: Dev/e2e testing (emails viewable at https://ethereal.email)
 * - Noop: No email provider configured (silently skips)
 */
export function getMailService(): MailService {
  if (!mailServiceInstance) {
    const env = getApiEnv();
    const providerType = getProviderType();

    let config: MailConfig | EtherealConfig;

    switch (providerType) {
      case "resend":
        config = {
          apiKey: env.RESEND_API_KEY ?? "",
          defaultFrom: env.RESEND_FROM_EMAIL,
          defaultReplyTo: env.MAIL_REPLY_TO_EMAIL || undefined,
        };
        break;
      case "ethereal":
        config = {
          apiKey: "",
          defaultFrom: "test@ethereal.email",
          defaultReplyTo: env.MAIL_REPLY_TO_EMAIL || undefined,
          etherealUser: env.ETHEREAL_USER,
          etherealPass: env.ETHEREAL_PASS,
        };
        break;
      case "noop":
      default:
        config = {
          apiKey: "",
          defaultFrom: "",
        };
        break;
    }

    const provider = createMailProvider(providerType, config);
    mailServiceInstance = createMailService(provider);
  }

  return mailServiceInstance;
}
