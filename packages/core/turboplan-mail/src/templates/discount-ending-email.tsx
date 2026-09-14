import { Heading, Img, Section, Text } from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import {
  badge,
  badgeTable,
  bodyText,
  bodyTextLight,
  card,
  ctaButtonTd,
  ctaLink,
  ctaTable,
  disclaimer,
  fallbackLabel,
  fallbackUrl,
  fallbackUrlBox,
  mascotImage,
  signatureText,
  title,
} from "./billing-email-styles";
import { getBeaverUrl } from "./email-images";

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
  const appName = getAppName();
  const daysLabel = `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;

  return (
    <BaseLayout
      preview={`${orgName}'s ${percentOff}% discount ends in ${daysLabel}`}
      label="Billing Update"
    >
      <Heading style={title}>Discount Ending Soon</Heading>

      <Section style={card}>
        <Img
          src={getBeaverUrl()}
          width="120"
          height="120"
          alt="Beaver mascot"
          style={mascotImage}
        />

        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={badgeTable}
        >
          <tr>
            <td align="center">
              <span style={badge}>{daysLabel} left</span>
            </td>
          </tr>
        </table>

        <Text style={bodyText}>
          The <strong>{percentOff}% discount</strong> on{" "}
          <strong>{orgName}</strong>'s subscription ends on{" "}
          <strong>{endsAtLabel}</strong>.
        </Text>

        <Text style={bodyTextLight}>
          From the next renewal after that date, the base subscription returns
          to the regular list price automatically — no action is required to
          keep your plan.
        </Text>

        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={ctaTable}
        >
          <tr>
            <td align="center" style={ctaButtonTd}>
              <a href={billingUrl} style={ctaLink} className="cta-link">
                <span
                  style={{ color: "#ffffff", textDecoration: "none" }}
                  className="cta-link"
                >
                  Review billing
                </span>
              </a>
            </td>
          </tr>
        </table>

        <Text style={signatureText}>
          Best regards,
          <br />
          The {preventAutoLink(appName)} Team
        </Text>
      </Section>

      <Text style={disclaimer}>
        This email was sent to {recipientEmail} because you are an owner of{" "}
        {orgName}.
      </Text>

      <Text style={fallbackLabel}>
        If you're having trouble with the button, copy and paste this URL into
        your browser:
      </Text>
      <Section style={fallbackUrlBox}>
        <Text style={fallbackUrl}>{billingUrl}</Text>
      </Section>
    </BaseLayout>
  );
}
