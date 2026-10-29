import { Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";
import {
  CtaButton,
  DetailsBox,
  DetailTitle,
  EmailHeading,
  FallbackUrl,
  Paragraph,
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
      label="Not approved"
      tone="danger"
      footer={`This email was sent to ${citizenEmail}. If you weren't expecting it, you can safely ignore it.`}
    >
      <EmailHeading>Your submission was reviewed</EmailHeading>

      <Paragraph>
        Your citizen submission <strong style={strong}>{projectName}</strong>{" "}
        has been reviewed by <strong style={strong}>{organizationName}</strong>.
        After careful consideration, it was not approved at this time.
      </Paragraph>

      <DetailsBox>
        <DetailTitle>Reason for decision</DetailTitle>
        <Text style={reasonText}>{rejectionReason}</Text>
      </DetailsBox>

      <Paragraph>
        You can review the feedback and additional details in your submission.
      </Paragraph>

      <CtaButton href={submissionUrl} label="Review Submission" />

      <FallbackUrl url={submissionUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};

const reasonText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  margin: "6px 0 0",
  whiteSpace: "pre-line" as const,
};
