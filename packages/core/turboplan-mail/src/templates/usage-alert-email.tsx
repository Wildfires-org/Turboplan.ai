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

export interface UsageAlertEmailProps {
  /** Name of the organization whose credit pool is filling up */
  orgName: string;
  /** Threshold crossed: 70, 90 or 100 (percent of the monthly allowance) */
  percentage: number;
  /** Credits consumed so far this period */
  creditsUsed: number;
  /** The period's total credit allowance */
  allowance: number;
  /**
   * True when the plan hard-stops at the allowance (free plan): at 100% AI
   * features pause. False on paid plans, where extra usage bills as overage.
   */
  hardStop: boolean;
  /** Deep link to the organization's billing settings */
  billingUrl: string;
  /** Recipient (owner) email — shown in the footer disclaimer */
  recipientEmail: string;
}

const formatCredits = (value: number): string => value.toLocaleString("en-US");

/**
 * Usage alert sent to organization owners when the credit pool crosses a
 * catalog threshold (70/90/100%). Copy differs for hard-stop plans (usage
 * pauses at 100%) versus paid plans (overage billing kicks in).
 */
export function UsageAlertEmail({
  orgName,
  percentage,
  creditsUsed,
  allowance,
  hardStop,
  billingUrl,
  recipientEmail,
}: UsageAlertEmailProps) {
  const appName = getAppName();
  const atLimit = percentage >= 100;

  const consequence = hardStop
    ? atLimit
      ? "AI features are paused until you upgrade or the pool resets next month."
      : "When the pool runs out, AI features pause until the monthly reset — upgrading lifts the cap."
    : atLimit
      ? "Further usage this month bills at your plan's overage rate."
      : "Usage beyond the included pool will bill at your plan's overage rate.";

  return (
    <BaseLayout
      preview={`${orgName} has used ${percentage}% of its monthly credits`}
      label="Usage Alert"
    >
      <Heading style={title}>
        {atLimit ? "Credits Used Up" : "Credit Usage Alert"}
      </Heading>

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
              <span style={badge}>{percentage}% of monthly credits</span>
            </td>
          </tr>
        </table>

        <Text style={bodyText}>
          <strong>{orgName}</strong> has used{" "}
          <strong>{formatCredits(creditsUsed)}</strong> of its{" "}
          <strong>{formatCredits(allowance)}</strong> monthly credits.
        </Text>

        <Text style={bodyTextLight}>{consequence}</Text>

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
                  View usage &amp; plans
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
        {orgName}. You get at most one email per threshold each billing period.
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
