import { Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";
import {
  CardMascot,
  CtaButton,
  Disclaimer,
  FallbackUrl,
  GradientCard,
  GreetingPill,
} from "./email-card";

export interface SubmissionRejectionEmailProps {
  /** Email of the citizen who submitted */
  citizenEmail: string;
  /** Name of the project/submission */
  projectName: string;
  /** Name of the organization that reviewed */
  organizationName: string;
  /** Reason the submission was rejected */
  rejectionReason: string;
  /** URL to review the submission */
  submissionUrl: string;
}

/**
 * Email sent when a citizen submission is rejected by an organization
 */
export function SubmissionRejectionEmail({
  citizenEmail,
  projectName,
  organizationName,
  rejectionReason,
  submissionUrl,
}: SubmissionRejectionEmailProps) {
  return (
    <BaseLayout
      preview={`Your citizen submission "${projectName}" has been reviewed by ${organizationName}`}
      label="Citizen Submission Update"
    >
      <GradientCard>
        <GreetingPill>Hello</GreetingPill>

        {/* Rejected Badge */}
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={badgeTable}
        >
          <tr>
            <td align="center">
              <span style={rejectedBadge}>Rejected</span>
            </td>
          </tr>
        </table>

        <Text style={bodyText}>
          Your citizen submission "<strong>{projectName}</strong>" has been
          reviewed by the <strong>{organizationName}</strong>. After careful
          consideration, the submission was not approved at this time.
        </Text>

        <Text style={bodyText}>
          <strong>Reason for decision:</strong>
          <br />
          {rejectionReason}
        </Text>

        <Text style={bodyTextLight}>
          You can review the feedback and additional details in your submission.
        </Text>

        <CtaButton href={submissionUrl} label="Review Submission" />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This email was sent to {citizenEmail}. If you weren't expecting this
        email, you can safely ignore it.
      </Disclaimer>

      <FallbackUrl url={submissionUrl} />
    </BaseLayout>
  );
}

// Styles
const badgeTable = {
  width: "100%",
  margin: "0 0 24px",
};

const rejectedBadge = {
  display: "inline-block",
  backgroundColor: "#fef2f2",
  border: "1px solid #fee2e2",
  borderRadius: "9999px",
  padding: "4px 16px",
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#ff2828",
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
  color: "rgba(255, 255, 255, 0.8)",
  textAlign: "center" as const,
  margin: "0 0 36px",
};
