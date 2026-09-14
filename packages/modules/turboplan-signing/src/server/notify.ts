import type { SigningRecipientRow } from "@wildfires-org/turboplan-db";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

import { getProjectSlugs, type ProjectSlugs } from "./queries";

const buildSigningPageUrl = (slugs: ProjectSlugs, appUrl: string): string =>
  `${appUrl}/organizations/${slugs.orgSlug}/offices/${slugs.officeSlug}/projects/${slugs.projectSlug}/signing`;

// These emails are assembled as raw HTML strings, so every interpolated value
// that originates from user input (document titles, recipient names, rejection
// reasons) must be escaped — otherwise a title like `<a href=...>` renders as
// live markup in the recipient's inbox. Also safe for attribute (href) values.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Emails a "please sign" invite to each given recipient. Used both at request
 * creation (the initially-released batch) and on each sequential release (the
 * single next recipient). Resolves project slugs once and is fire-and-forget
 * safe — every send is awaited but failures are logged, never thrown.
 */
export const sendInviteEmails = async (
  projectId: string,
  recipients: SigningRecipientRow[],
  requesterName: string,
  documentTitle: string,
): Promise<void> => {
  if (recipients.length === 0) {
    return;
  }

  const slugs = await getProjectSlugs(projectId);
  if (!slugs) {
    return;
  }

  const signingUrl = buildSigningPageUrl(slugs, getApiEnv().TURBOPLAN_URL);
  const mailService = getMailService();

  await Promise.all(
    recipients.map((recipient) =>
      mailService
        .sendSigningRequestEmail({
          to: recipient.email,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          requesterName,
          documentTitle,
          projectName: slugs.name,
          signingUrl,
        })
        .catch((err) => {
          console.error(
            `Failed to send signing invite to ${recipient.email}:`,
            err,
          );
        }),
    ),
  );
};

/**
 * Notifies the requester and everyone who already signed that the request was
 * halted by a rejection, including the reason. Matches Documenso/DocuSign: one
 * rejection stops the whole envelope.
 */
export const notifyRejection = async (params: {
  projectId: string;
  documentTitle: string;
  requesterEmail: string | null;
  recipients: SigningRecipientRow[];
  rejectedByName: string;
  reason: string | null;
}): Promise<void> => {
  const slugs = await getProjectSlugs(params.projectId);
  const link = slugs
    ? buildSigningPageUrl(slugs, getApiEnv().TURBOPLAN_URL)
    : null;

  // Requester + already-signed recipients, de-duplicated by email.
  const audience = new Set<string>();
  if (params.requesterEmail) {
    audience.add(params.requesterEmail);
  }
  for (const r of params.recipients) {
    if (r.signingStatus === "signed") {
      audience.add(r.email);
    }
  }
  if (audience.size === 0) {
    return;
  }

  const reasonLine = params.reason
    ? `<p>Reason: ${escapeHtml(params.reason)}</p>`
    : "<p>No reason was provided.</p>";
  const linkLine = link
    ? `<p><a href="${escapeHtml(link)}">View signing requests</a></p>`
    : "";
  const safeTitle = escapeHtml(params.documentTitle);
  const safeRejectedBy = escapeHtml(params.rejectedByName);

  const mailService = getMailService();
  await Promise.all(
    Array.from(audience).map((to) =>
      mailService
        .sendEmail({
          to,
          subject: `Signing rejected: "${params.documentTitle}"`,
          html: `<p>${safeRejectedBy} rejected the signing request for "${safeTitle}". The request has been cancelled — create a new one to try again.</p>${reasonLine}${linkLine}`,
        })
        .catch((err) => {
          console.error(`Failed to send rejection notice to ${to}:`, err);
        }),
    ),
  );
};

/**
 * Sends the fully-signed PDF link to every CC recipient once the request
 * completes. Because distributionMethod is NONE, Documenso never emails CCs —
 * this is the app's "CC receives a copy" path.
 */
export const sendCcCopies = async (params: {
  projectId: string;
  documentTitle: string;
  recipients: SigningRecipientRow[];
  signedDocumentUrl: string | null | undefined;
}): Promise<void> => {
  const ccRecipients = params.recipients.filter((r) => r.role === "cc");
  if (ccRecipients.length === 0 || !params.signedDocumentUrl) {
    return;
  }

  const safeUrl = escapeHtml(params.signedDocumentUrl);
  const safeTitle = escapeHtml(params.documentTitle);

  const mailService = getMailService();
  await Promise.all(
    ccRecipients.map((recipient) =>
      mailService
        .sendEmail({
          to: recipient.email,
          subject: `Signed copy: "${params.documentTitle}"`,
          html: `<p>Hi ${escapeHtml(recipient.name)},</p><p>"${safeTitle}" has been fully signed. You were copied on this document.</p><p><a href="${safeUrl}">Download the signed document</a></p>`,
        })
        .catch((err) => {
          console.error(`Failed to send CC copy to ${recipient.email}:`, err);
        }),
    ),
  );
};
