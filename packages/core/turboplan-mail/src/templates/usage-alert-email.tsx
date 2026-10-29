import { BaseLayout } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

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
      label={`${percentage}% of monthly credits`}
      tone="warning"
      footer={`This email was sent to ${recipientEmail} because you are an owner of ${orgName}. You get at most one email per threshold each billing period.`}
    >
      <EmailHeading>
        {atLimit ? "You've used all your credits" : "Credit usage alert"}
      </EmailHeading>

      <Paragraph>
        <strong style={strong}>{orgName}</strong> has used{" "}
        <strong style={strong}>{formatCredits(creditsUsed)}</strong> of its{" "}
        <strong style={strong}>{formatCredits(allowance)}</strong> monthly
        credits.
      </Paragraph>

      <Paragraph>{consequence}</Paragraph>

      <CtaButton href={billingUrl} label="View usage & plans" />

      <FallbackUrl url={billingUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
