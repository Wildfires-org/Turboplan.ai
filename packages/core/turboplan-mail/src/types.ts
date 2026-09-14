import type { ReactElement } from "react";

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
  /** Recipient email address */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** React Email component to render */
  react?: ReactElement;
  /** Plain HTML content (alternative to react) */
  html?: string;
  /** Plain text content (fallback) */
  text?: string;
  /** Sender email address (optional, uses default if not provided) */
  from?: string;
  /** Reply-to email address */
  replyTo?: string;
}

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Provider-specific message ID */
  messageId?: string;
  /** Error message if sending failed */
  error?: string;
}

/**
 * Abstract mail provider interface
 * Implement this interface to add support for new email providers
 */
export interface MailProvider {
  /** Send an email using this provider */
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}

/**
 * Configuration for the mail service
 */
export interface MailConfig {
  /** Default sender email address */
  defaultFrom: string;
  /** Default reply-to email address (used when an email does not set its own) */
  defaultReplyTo?: string;
  /** API key for the mail provider */
  apiKey: string;
}
