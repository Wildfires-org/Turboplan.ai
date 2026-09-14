import { Resend } from "resend";

import type {
  MailConfig,
  MailProvider,
  SendEmailOptions,
  SendEmailResult,
} from "../types";

/**
 * Resend email provider implementation
 * @see https://resend.com/docs
 */
export class ResendProvider implements MailProvider {
  private client: Resend;
  private defaultFrom: string;
  private defaultReplyTo?: string;

  constructor(config: MailConfig) {
    this.client = new Resend(config.apiKey);
    this.defaultFrom = config.defaultFrom;
    this.defaultReplyTo = config.defaultReplyTo;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: options.from ?? this.defaultFrom,
        to: options.to,
        subject: options.subject,
        react: options.react,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo ?? this.defaultReplyTo,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
