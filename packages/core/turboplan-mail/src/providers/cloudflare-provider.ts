import { render } from "@react-email/render";

import type {
  MailConfig,
  MailProvider,
  SendEmailOptions,
  SendEmailResult,
} from "../types";

type EmailAddress = { name: string; email: string };

/**
 * The part of a Cloudflare Workers `send_email` binding this provider uses
 * (Cloudflare Email Sending's structured `send`). Declared here so the package
 * does not depend on `@cloudflare/workers-types`.
 */
export type CloudflareEmailBinding = {
  send(message: {
    from: string | EmailAddress;
    to: string | string[];
    subject: string;
    replyTo?: string | EmailAddress;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
};

export interface CloudflareEmailConfig extends MailConfig {
  binding: CloudflareEmailBinding;
}

/** "Name <a@b.c>" → { name, email }; a bare address stays a string. */
const parseAddress = (value: string): string | EmailAddress => {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (!match) {
    return value.trim();
  }
  const [, name, email] = match;
  return name ? { name, email: email.trim() } : email.trim();
};

/**
 * Sends through Cloudflare Email Sending, using the Worker's `send_email`
 * binding. The sender must be on a domain with Email Sending enabled.
 * @see https://developers.cloudflare.com/email-service/
 */
export class CloudflareEmailProvider implements MailProvider {
  private binding: CloudflareEmailBinding;
  private defaultFrom: string;
  private defaultReplyTo?: string;

  constructor(config: CloudflareEmailConfig) {
    this.binding = config.binding;
    this.defaultFrom = config.defaultFrom;
    this.defaultReplyTo = config.defaultReplyTo;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const html = options.react ? await render(options.react) : options.html;
      const text = options.react
        ? await render(options.react, { plainText: true })
        : options.text;
      const replyTo = options.replyTo ?? this.defaultReplyTo;

      const { messageId } = await this.binding.send({
        from: parseAddress(options.from ?? this.defaultFrom),
        to: options.to,
        subject: options.subject,
        html,
        text,
        ...(replyTo && { replyTo: parseAddress(replyTo) }),
      });

      return { success: true, messageId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }
}
