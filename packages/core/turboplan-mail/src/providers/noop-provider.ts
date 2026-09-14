import type {
  MailConfig,
  MailProvider,
  SendEmailOptions,
  SendEmailResult,
} from "../types";

/**
 * No-op email provider that silently skips sending
 * Used when no email provider is configured
 */
export class NoopProvider implements MailProvider {
  constructor(_config: MailConfig) {
    // Log warning once on initialization
    console.warn(
      "[Mail] No email provider configured. " +
        "Set RESEND_API_KEY for production or ETHEREAL_USER/ETHEREAL_PASS for testing. " +
        "Emails will be skipped.",
    );
  }

  async sendEmail(_options: SendEmailOptions): Promise<SendEmailResult> {
    // Silently succeed without doing anything
    return {
      success: true,
      messageId: undefined,
    };
  }
}
