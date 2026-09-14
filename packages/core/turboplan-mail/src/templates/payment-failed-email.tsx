import { Heading, Img, Section, Text } from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import { getBeaverUrl } from "./email-images";

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
      label="Billing Update"
    >
      {/* Title */}
      <Heading style={title}>Payment Failed</Heading>

      {/* Amber Gradient Card */}
      <Section style={amberCard}>
        <Img
          src={getBeaverUrl()}
          width="120"
          height="120"
          alt="Beaver mascot"
          style={mascotImage}
        />

        {/* Action Required Badge */}
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={badgeTable}
        >
          <tr>
            <td align="center">
              <span style={actionBadge}>Action required</span>
            </td>
          </tr>
        </table>

        <Text style={bodyText}>
          We were unable to process the latest payment for your{" "}
          <strong>{orgName}</strong> subscription.
        </Text>

        <Text style={bodyText}>
          No action is needed right away — Stripe will automatically retry the
          charge over the next few days. If it keeps failing, your subscription
          may eventually be paused.
        </Text>

        <Text style={bodyTextLight}>
          To avoid any interruption, update your payment method in your billing
          settings.
        </Text>

        {/* CTA Button */}
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
                  Update payment method
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

      {/* Disclaimer */}
      <Text style={disclaimer}>
        This email was sent to {recipientEmail} because you are an owner of{" "}
        {orgName}. If you weren't expecting this email, you can safely ignore
        it.
      </Text>

      {/* Fallback URL */}
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

// Styles
const title = {
  fontSize: "36px",
  fontFamily: "'Geist Mono', monospace",
  color: "#1b845c",
  textAlign: "center" as const,
  letterSpacing: "-2.52px",
  padding: "18px 0",
  margin: "0",
  fontWeight: "500" as const,
};

const amberCard = {
  background: "linear-gradient(180deg, #f3c98b 0%, #e0913f 100%)",
  borderRadius: "12px",
  padding: "42px",
  textAlign: "center" as const,
  marginBottom: "30px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  overflow: "hidden" as const,
};

const mascotImage = {
  margin: "0 auto 24px",
  display: "block",
};

const badgeTable = {
  width: "100%",
  margin: "0 0 24px",
};

const actionBadge = {
  display: "inline-block",
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "9999px",
  padding: "4px 16px",
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#c2410c",
};

const bodyText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const bodyTextLight = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  opacity: "0.8",
  textAlign: "center" as const,
  margin: "0 0 36px",
};

const ctaTable = {
  width: "100%",
  margin: "0 0 36px",
};

const ctaButtonTd = {
  backgroundColor: "#000000",
  borderRadius: "6px",
  padding: "12px 0",
  textAlign: "center" as const,
};

const ctaLink = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "400" as const,
  textDecoration: "none",
  display: "inline-block",
  width: "100%",
};

const signatureText = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#ffffff",
  textAlign: "center" as const,
  lineHeight: "22px",
  margin: "0",
};

const disclaimer = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#9ca3af",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 30px",
};

const fallbackLabel = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#262626",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 12px",
};

const fallbackUrlBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "6px 0",
};

const fallbackUrl = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#80bfff",
  textAlign: "center" as const,
  letterSpacing: "0.24px",
  lineHeight: "16px",
  margin: "0",
  wordBreak: "break-all" as const,
};
