import { render } from "@react-email/render";
import nodemailer from "nodemailer";

import type {
  MailConfig,
  MailProvider,
  SendEmailOptions,
  SendEmailResult,
} from "../types";

/**
 * Configuration for the Ethereal provider
 * - If credentials are provided via env (ETHEREAL_USER/ETHEREAL_PASS), uses those
 * - Otherwise, auto-creates a test account on first use
 */
export interface EtherealConfig extends MailConfig {
  /** Ethereal username (optional - will create account if not provided) */
  etherealUser?: string;
  /** Ethereal password (optional - will create account if not provided) */
  etherealPass?: string;
}

/**
 * Ethereal email provider for development and e2e testing
 * Uses https://ethereal.email/ to capture emails in a real inbox
 *
 * Emails are not actually delivered but can be viewed at:
 * https://ethereal.email/messages
 *
 * @see https://nodemailer.com/smtp/testing/
 */
export class EtherealProvider implements MailProvider {
  private defaultFrom: string;
  private defaultReplyTo?: string;
  private etherealUser?: string;
  private etherealPass?: string;
  private transporter: nodemailer.Transporter | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: EtherealConfig) {
    this.defaultFrom = config.defaultFrom;
    this.defaultReplyTo = config.defaultReplyTo;
    this.etherealUser = config.etherealUser;
    this.etherealPass = config.etherealPass;
  }

  /**
   * Initialize the transporter (creates test account if needed)
   */
  private async initialize(): Promise<void> {
    if (this.transporter) return;

    // If we're already initializing, wait for that
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.createTransporter();
    await this.initPromise;
  }

  private async createTransporter(): Promise<void> {
    let user = this.etherealUser;
    let pass = this.etherealPass;

    // If credentials not provided, create a test account
    if (!user || !pass) {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
    }

    this.transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      await this.initialize();

      if (!this.transporter) {
        return {
          success: false,
          error: "Failed to initialize Ethereal transporter",
        };
      }

      const from = options.from ?? this.defaultFrom;
      const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;

      // Render React component to HTML if provided
      let html = options.html;
      if (options.react) {
        html = await render(options.react);
      }

      const info = await this.transporter.sendMail({
        from,
        to,
        subject: options.subject,
        text: options.text,
        html,
        replyTo: options.replyTo ?? this.defaultReplyTo,
      });

      return {
        success: true,
        messageId: info.messageId,
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
