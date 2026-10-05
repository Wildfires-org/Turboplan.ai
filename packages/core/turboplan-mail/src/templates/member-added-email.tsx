import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

export type MemberAddedEntityType = "organization" | "office" | "project";

export interface MemberAddedEmailProps {
  /** Email of the person who was added */
  memberEmail: string;
  /** Display name for the greeting pill */
  memberName?: string;
  /** Name of the person who added them */
  inviterName: string;
  /** Name of the entity (organization, office, or project) */
  entityName: string;
  /** Type of entity they were added to */
  entityType: MemberAddedEntityType;
  /** Deep link to the entity page */
  entityUrl: string;
}

function getUpdateLabel(entityType: MemberAddedEntityType): string {
  switch (entityType) {
    case "organization":
      return "Organization Update";
    case "office":
      return "Office Update";
    case "project":
      return "Project Update";
    default:
      return "Workspace Update";
  }
}

function getOpenLabel(entityType: MemberAddedEntityType): string {
  switch (entityType) {
    case "organization":
      return "Open Organization";
    case "office":
      return "Open Office";
    case "project":
      return "Open Project";
    default:
      return "Open Workspace";
  }
}

/**
 * Notification email sent when an existing user is added directly to an
 * organization, office, or project.
 */
export function MemberAddedEmail({
  memberEmail,
  memberName,
  inviterName,
  entityName,
  entityType,
  entityUrl,
}: MemberAddedEmailProps) {
  const appName = getAppName();

  return (
    <BaseLayout
      preview={`${inviterName} added you to ${entityName} on ${appName}`}
      label={getUpdateLabel(entityType)}
      footer={`This notification was sent to ${memberEmail} because you were added to ${entityName}.`}
    >
      <EmailHeading>
        {memberName ? `${memberName}, you're in!` : "You're in!"}
      </EmailHeading>

      <Paragraph>
        <strong style={strong}>{inviterName}</strong> has added you to the{" "}
        <strong style={strong}>{entityName}</strong> {entityType} on{" "}
        {preventAutoLink(appName)}.
      </Paragraph>

      <Paragraph>
        You already have an account, so you're all set — jump right in.
      </Paragraph>

      <CtaButton href={entityUrl} label={getOpenLabel(entityType)} />

      <FallbackUrl url={entityUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
