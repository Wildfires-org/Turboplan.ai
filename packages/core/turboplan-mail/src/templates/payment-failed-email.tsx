import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

export interface PaymentFailedEmailProps {
  /** Name of the organization whose payment failed */
  orgName: string;
  /** Deep link to the organization's billing settings ("Update payment method") */
  billingUrl: string;
  /** Recipient (owner) email — shown in the footer disclaimer */
  recipientEmail: string;
}

/**
 * Dunning email sent to organization owners when a subscription invoice payment
 * fails. Reassures that Stripe will retry automatically and points owners at
 * billing settings to update their payment method.
 */
export function PaymentFailedEmail({
  orgName,
  billingUrl,
  recipientEmail,
}: PaymentFailedEmailProps) {
  const appName = getAppName();

  return (
    <BaseLayout
      preview={`We couldn't process the payment for ${orgName}`}
      label="Action required"
      tone="warning"
      footer={`This email was sent to ${recipientEmail} because you are an owner of ${orgName}. If you weren't expecting it, you can safely ignore it.`}
    >
      <EmailHeading>Payment failed</EmailHeading>

      <Paragraph>
        We were unable to process the latest payment for your{" "}
        <strong style={strong}>{orgName}</strong> subscription on{" "}
        {preventAutoLink(appName)}.
      </Paragraph>

      <Paragraph>
        No action is needed right away — Stripe will automatically retry the
        charge over the next few days. If it keeps failing, your subscription
        may eventually be paused. To avoid any interruption, update your payment
        method.
      </Paragraph>

      <CtaButton href={billingUrl} label="Update payment method" />

      <FallbackUrl url={billingUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
