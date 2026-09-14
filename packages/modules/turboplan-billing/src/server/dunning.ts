import { eq } from "drizzle-orm";

import { organization } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

import {
  getOrganizationOwnerEmails,
  getSubscriptionByStripeSubscriptionId,
} from "./queries";

/**
 * Sends the "payment failed" dunning email to every OWNER of the organization
 * that owns the given Stripe subscription. Triggered from the
 * `invoice.payment_failed` webhook.
 *
 * Best-effort by design: any missing prerequisite (unknown subscription, no
 * owners, mail not configured) results in a silent no-op, and individual send
 * failures are caught and logged. The mail provider itself falls back to a
 * no-op when `RESEND_API_KEY` is unset (see turboplan-mail `mail-instance.ts`),
 * so no explicit env check is needed here. Callers should still wrap the call in
 * their own try/catch so a mail outage never fails the webhook response.
 */
export const sendPaymentFailedEmail = async (
  stripeSubscriptionId: string,
): Promise<void> => {
  const subscriptionRow =
    await getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!subscriptionRow) {
    return;
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, subscriptionRow.organizationId),
    columns: { slug: true, name: true },
  });
  if (!org) {
    return;
  }

  const ownerEmails = await getOrganizationOwnerEmails(
    subscriptionRow.organizationId,
  );
  if (ownerEmails.length === 0) {
    return;
  }

  const billingUrl = `${getApiEnv().TURBOPLAN_URL}/organizations/${org.slug}/billing`;
  const mailService = getMailService();

  await Promise.all(
    ownerEmails.map((email) =>
      mailService
        .sendPaymentFailedEmail({
          to: email,
          orgName: org.name,
          billingUrl,
          recipientEmail: email,
        })
        .catch((error) => {
          console.error(
            `[billing] payment-failed email to ${email} failed:`,
            error,
          );
        }),
    ),
  );
};
