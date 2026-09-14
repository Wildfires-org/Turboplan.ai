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

export interface SubmissionAcceptanceEmailProps {
  /** Email of the citizen who submitted */
  citizenEmail: string;
  /** Name of the project/submission */
  projectName: string;
  /** Name of the organization that reviewed */
  organizationName: string;
  /** URL to view the created project */
  projectUrl: string;
}

/**
 * Email sent when a citizen submission is accepted by an organization
 * and converted into a project.
 */
export const SubmissionAcceptanceEmail = ({
  citizenEmail,
  projectName,
  organizationName,
  projectUrl,
}: SubmissionAcceptanceEmailProps) => {
  return (
    <BaseLayout
      preview={`Your citizen submission "${projectName}" has been approved by ${organizationName}`}
      label="Citizen Submission Update"
    >
      <GradientCard>
        <GreetingPill>Hello</GreetingPill>

        {/* Accepted Badge */}
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={badgeTable}
        >
          <tr>
            <td align="center">
              <span style={acceptedBadge}>Accepted</span>
            </td>
          </tr>
        </table>

        <Text style={bodyText}>
          Your citizen submission "<strong>{projectName}</strong>" has been
          reviewed by the <strong>{organizationName}</strong>.
        </Text>

        <Text style={bodyText}>
          We're pleased to inform you that your submission has been approved and
          converted into a project.
        </Text>

        <Text style={bodyTextLight}>
          You can review the project details and follow its progress in your
          workspace.
        </Text>

        <CtaButton href={projectUrl} label="View Project" />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This email was sent to {citizenEmail}. If you weren't expecting this
        email, you can safely ignore it.
      </Disclaimer>

      <FallbackUrl url={projectUrl} />
    </BaseLayout>
  );
};

// Styles
const badgeTable = {
  width: "100%",
  margin: "0 0 24px",
};

const acceptedBadge = {
  display: "inline-block",
  backgroundColor: "#ebfef7",
  border: "1px solid #c2fde5",
  borderRadius: "8px",
  padding: "12px 24px",
  fontSize: "16px",
  fontWeight: "500" as const,
  color: "#05b871",
  letterSpacing: "0.065px",
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
