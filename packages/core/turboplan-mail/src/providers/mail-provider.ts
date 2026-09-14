import type { MailConfig, MailProvider } from "../types";
import { type EtherealConfig, EtherealProvider } from "./ethereal-provider";
import { NoopProvider } from "./noop-provider";
import { ResendProvider } from "./resend-provider";

/**
 * Supported mail provider types
 * - "resend": Production email sending via Resend API
 * - "ethereal": Development/testing - sends to Ethereal's fake SMTP (viewable inbox)
 * - "noop": Silent no-op provider (skips sending, no logs)
 */
export type ProviderType = "resend" | "ethereal" | "noop";

/**
 * Factory function to create a mail provider
 * Allows easy switching between providers by changing the type parameter
 *
 * @example
 * // Production - use Resend
 * const provider = createMailProvider("resend", {
 *   apiKey: process.env.RESEND_API_KEY,
 *   defaultFrom: "noreply@example.com",
 * });
 *
 * @example
 * // Development/E2E - use Ethereal (emails viewable at https://ethereal.email)
 * const provider = createMailProvider("ethereal", {
 *   apiKey: "not-needed",
 *   defaultFrom: "noreply@example.com",
 *   etherealUser: process.env.ETHEREAL_USER,
 *   etherealPass: process.env.ETHEREAL_PASS,
 * });
 *
 * @example
 * // No email provider configured - silently skip
 * const provider = createMailProvider("noop", {
 *   apiKey: "",
 *   defaultFrom: "",
 * });
 *
 * @param type - The provider type to use
 * @param config - Configuration for the provider
 * @returns A MailProvider instance
 */
export function createMailProvider(
  type: ProviderType,
  config: MailConfig | EtherealConfig,
): MailProvider {
  switch (type) {
    case "resend":
      return new ResendProvider(config);
    case "ethereal":
      return new EtherealProvider(config as EtherealConfig);
    case "noop":
      return new NoopProvider(config);
    default:
      throw new Error(`Unknown mail provider type: ${type}`);
  }
}
