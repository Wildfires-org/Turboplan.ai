import { BaseLayout } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

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
      label="Accepted"
      footer={`This email was sent to ${citizenEmail}. If you weren't expecting it, you can safely ignore it.`}
    >
      <EmailHeading>Your submission was approved</EmailHeading>

      <Paragraph>
        Your citizen submission <strong style={strong}>{projectName}</strong>{" "}
        has been reviewed by <strong style={strong}>{organizationName}</strong>{" "}
        and converted into a project.
      </Paragraph>

      <Paragraph>
        You can review the project details and follow its progress in your
        workspace.
      </Paragraph>

      <CtaButton href={projectUrl} label="View Project" />

      <FallbackUrl url={projectUrl} />
    </BaseLayout>
  );
};

// Styles
const strong = {
  color: "#111827",
};
