import { BaseLayout } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

export interface DiscountEndingEmailProps {
  /** Name of the organization whose discount is expiring */
  orgName: string;
  /** The discount percentage that is about to end */
  percentOff: number;
  /** Days until the first full-price renewal (30 or 7) */
  daysLeft: number;
  /** Human-readable end date, e.g. "August 29, 2026" */
  endsAtLabel: string;
  /** Deep link to the organization's billing settings */
  billingUrl: string;
  /** Recipient (owner) email — shown in the footer disclaimer */
  recipientEmail: string;
}

/**
 * Sent to organization owners 30 and 7 days before a subscription discount
 * (e.g. the startup program's 50% off) expires and the base price returns to
 * list. Doc §8: notify before the first full-price renewal.
 */
export function DiscountEndingEmail({
  orgName,
  percentOff,
  daysLeft,
  endsAtLabel,
  billingUrl,
  recipientEmail,
}: DiscountEndingEmailProps) {
  const daysLabel = `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;

  return (
    <BaseLayout
      preview={`${orgName}'s ${percentOff}% discount ends in ${daysLabel}`}
      label={`${daysLabel} left`}
      tone="warning"
      footer={`This email was sent to ${recipientEmail} because you are an owner of ${orgName}.`}
    >
      <EmailHeading>Your discount ends soon</EmailHeading>

      <Paragraph>
        The <strong style={strong}>{percentOff}% discount</strong> on{" "}
        <strong style={strong}>{orgName}</strong>'s subscription ends on{" "}
        <strong style={strong}>{endsAtLabel}</strong>.
      </Paragraph>

      <Paragraph>
        From the next renewal after that date, the base subscription returns to
        the regular list price automatically — no action is required to keep
        your plan.
      </Paragraph>

      <CtaButton href={billingUrl} label="Review billing" />

      <FallbackUrl url={billingUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
