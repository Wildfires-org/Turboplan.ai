/**
 * Ethereal email utilities for e2e testing.
 * Allows fetching emails from Ethereal inbox to verify email sending.
 *
 * @see https://ethereal.email/
 */

import { ImapFlow } from "imapflow";

/**
 * Decode Quoted-Printable encoded string
 * In QP encoding: =XX represents a hex byte, = at EOL is soft line break
 */
function decodeQuotedPrintable(str: string): string {
  // First, join soft line breaks (= at end of line)
  let decoded = str.replace(/=\r?\n/g, "");

  // Then decode =XX hex sequences
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

export interface EtherealCredentials {
  user: string;
  pass: string;
}

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  date: Date;
  /** Raw email source for debugging */
  rawSource?: string;
}

/**
 * Get Ethereal credentials from environment variables
 */
export function getEtherealCredentials(): EtherealCredentials | null {
  const user = process.env.ETHEREAL_USER;
  const pass = process.env.ETHEREAL_PASS;

  if (!user || !pass) {
    console.warn(
      "[Ethereal] ETHEREAL_USER and ETHEREAL_PASS not set - email tests will be skipped",
    );
    return null;
  }

  return { user, pass };
}

/**
 * Fetch emails from Ethereal inbox
 *
 * @param credentials - Ethereal IMAP credentials
 * @param options - Filter options
 * @returns Array of parsed emails
 */
export async function fetchEtherealEmails(
  credentials: EtherealCredentials,
  options: {
    /** Filter by recipient email */
    to?: string;
    /** Filter by subject (partial match) */
    subject?: string;
    /** Only fetch emails from the last N minutes */
    sinceMinutes?: number;
    /** Maximum number of emails to fetch */
    limit?: number;
  } = {},
): Promise<ParsedEmail[]> {
  const client = new ImapFlow({
    host: "imap.ethereal.email",
    port: 993,
    secure: true,
    auth: {
      user: credentials.user,
      pass: credentials.pass,
    },
    logger: false,
  });

  let allEmails: ParsedEmail[] = [];

  try {
    await client.connect();

    // Select INBOX
    const mailbox = await client.mailboxOpen("INBOX");

    console.log(`[Ethereal] Mailbox opened, ${mailbox.exists} messages total`);

    // Fetch most recent messages (simpler than complex IMAP search)
    // We'll filter in JavaScript for reliability
    let count = 0;
    const fetchLimit = 50; // Fetch more than needed, filter later

    // Calculate range to fetch the most recent messages
    // IMAP sequence numbers are 1-based, so we fetch from (total - limit + 1) to total
    const startSeq = Math.max(1, mailbox.exists - fetchLimit + 1);
    const fetchRange = `${startSeq}:*`;

    for await (const message of client.fetch(fetchRange, {
      envelope: true,
      source: true,
    })) {
      if (count >= fetchLimit) break;

      const envelope = message.envelope;
      if (!envelope) continue;

      const source = message.source?.toString() || "";

      // Check if content is Quoted-Printable encoded
      const isQuotedPrintable = source.includes(
        "Content-Transfer-Encoding: quoted-printable",
      );

      // Extract HTML content from raw source - try multiple patterns
      // Pattern 1: HTML part in multipart message (most common)
      let htmlContent =
        source.match(
          /Content-Type:\s*text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--)/i,
        )?.[1] ||
        // Pattern 2: Full HTML document
        source.match(/<html[^>]*>[\s\S]*<\/html>/i)?.[0] ||
        // Pattern 3: Any HTML-like content with body
        source.match(/<body[^>]*>[\s\S]*<\/body>/i)?.[0] ||
        "";

      // Decode Quoted-Printable if needed
      if (htmlContent && isQuotedPrintable) {
        htmlContent = decodeQuotedPrintable(htmlContent);
      }

      // If we still don't have HTML content, try to extract from base64 encoded parts
      if (
        !htmlContent &&
        source.includes("Content-Transfer-Encoding: base64")
      ) {
        const base64Match = source.match(
          /Content-Type:\s*text\/html[\s\S]*?Content-Transfer-Encoding:\s*base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/i,
        );
        if (base64Match?.[1]) {
          try {
            htmlContent = Buffer.from(
              base64Match[1].replace(/\r?\n/g, ""),
              "base64",
            ).toString("utf-8");
          } catch {
            // Ignore base64 decode errors
          }
        }
      }

      // Extract text content
      const textMatch = source.match(
        /Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|\r\n\r\n)/,
      );

      allEmails.push({
        from: envelope.from?.[0]?.address || "",
        to: envelope.to?.[0]?.address || "",
        subject: envelope.subject || "",
        html: htmlContent || undefined,
        text: textMatch?.[1]?.trim(),
        date: envelope.date || new Date(),
        rawSource: source.substring(0, 10000), // First 10KB for debugging
      });

      count++;
    }

    await client.logout();
  } catch (error) {
    console.error("[Ethereal] Failed to fetch emails:", error);
    try {
      await client.logout();
    } catch {
      // Ignore logout errors
    }
    throw error;
  }

  console.log(`[Ethereal] Fetched ${allEmails.length} emails total`);

  // Apply filters in JavaScript (more reliable than IMAP search)
  let filteredEmails = allEmails;

  // Filter by time
  if (options.sinceMinutes) {
    const since = new Date(Date.now() - options.sinceMinutes * 60 * 1000);
    filteredEmails = filteredEmails.filter((e) => e.date >= since);
    console.log(
      `[Ethereal] After time filter (${options.sinceMinutes}min): ${filteredEmails.length} emails`,
    );
  }

  // Filter by recipient
  if (options.to) {
    const targetTo = options.to.toLowerCase();
    filteredEmails = filteredEmails.filter(
      (e) => e.to.toLowerCase() === targetTo,
    );
    console.log(
      `[Ethereal] After 'to' filter (${options.to}): ${filteredEmails.length} emails`,
    );
  }

  // Filter by subject (partial match)
  if (options.subject) {
    const targetSubject = options.subject.toLowerCase();
    filteredEmails = filteredEmails.filter((e) =>
      e.subject.toLowerCase().includes(targetSubject),
    );
    console.log(
      `[Ethereal] After subject filter (${options.subject}): ${filteredEmails.length} emails`,
    );
  }

  // Sort by date (newest first) and limit
  filteredEmails.sort((a, b) => b.date.getTime() - a.date.getTime());
  const limit = options.limit || 10;

  return filteredEmails.slice(0, limit);
}

/**
 * Wait for an email to arrive in Ethereal inbox
 *
 * @param credentials - Ethereal IMAP credentials
 * @param options - Filter and timeout options
 * @returns The matching email or null if timeout
 */
export async function waitForEmail(
  credentials: EtherealCredentials,
  options: {
    /** Filter by recipient email */
    to: string;
    /** Filter by subject (partial match) */
    subject?: string;
    /** Timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Poll interval in milliseconds (default: 2000) */
    pollInterval?: number;
    /** Only look at emails from the last N minutes (default: 60) */
    sinceMinutes?: number;
  },
): Promise<ParsedEmail | null> {
  const timeout = options.timeout || 30000;
  const pollInterval = options.pollInterval || 2000;
  const sinceMinutes = options.sinceMinutes || 60;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const emails = await fetchEtherealEmails(credentials, {
      to: options.to,
      subject: options.subject,
      sinceMinutes,
      limit: 5,
    });

    if (emails.length > 0) {
      // Return the most recent matching email
      return emails.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return null;
}
