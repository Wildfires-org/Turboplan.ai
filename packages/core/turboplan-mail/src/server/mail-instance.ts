import { getApiEnv } from "@wildfires-org/turboplan-env";

import { createMailProvider, type ProviderType } from "../providers";
import type {
  CloudflareEmailBinding,
  CloudflareEmailConfig,
} from "../providers/cloudflare-provider";
import type { EtherealConfig } from "../providers/ethereal-provider";
import { createMailService, type MailService } from "../services";
import type { MailConfig } from "../types";

let mailServiceInstance: MailService | null = null;
let cloudflareEmailBinding: CloudflareEmailBinding | null = null;

/**
 * Registers the Worker's `send_email` binding (Cloudflare Email Sending). The
 * API Worker entry calls this before the first request is handled; once set,
 * mail goes through Cloudflare instead of Resend.
 */
export const setCloudflareEmailBinding = (
  binding: CloudflareEmailBinding,
): void => {
  cloudflareEmailBinding = binding;
  mailServiceInstance = null;
};

/**
 * Determine which mail provider to use based on environment
 * - If a Cloudflare `send_email` binding is registered → use Cloudflare
 * - If RESEND_API_KEY is set → use Resend (production)
 * - If ETHEREAL_USER and ETHEREAL_PASS are set → use Ethereal (dev/e2e testing)
 * - Otherwise → use Noop (silently skip email sending)
 */
function getProviderType(): ProviderType {
  const env = getApiEnv();

  if (cloudflareEmailBinding) {
    return "cloudflare";
  }

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

    let config: MailConfig | EtherealConfig | CloudflareEmailConfig;

    switch (providerType) {
      case "cloudflare":
        config = {
          apiKey: "",
          binding: cloudflareEmailBinding as CloudflareEmailBinding,
          defaultFrom: env.RESEND_FROM_EMAIL,
          defaultReplyTo: env.MAIL_REPLY_TO_EMAIL || undefined,
        };
        break;
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
