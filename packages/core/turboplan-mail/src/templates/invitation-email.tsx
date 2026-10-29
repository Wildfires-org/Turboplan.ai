import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

export type InvitationEntityType = "organization" | "office" | "project";

export interface InvitationEmailProps {
  /** Email of the person being invited */
  inviteeEmail: string;
  /** Name of the person who sent the invitation */
  inviterName: string;
  /** Name of the entity (organization, office, or project) */
  entityName: string;
  /** Type of entity being invited to */
  entityType: InvitationEntityType;
  /** URL to accept the invitation */
  inviteUrl: string;
}

/**
 * Get human-readable entity type label.
 * Exported for use in mail.service.ts.
 */
export function getEntityTypeLabel(entityType: InvitationEntityType): string {
  switch (entityType) {
    case "organization":
      return "organization";
    case "office":
      return "office";
    case "project":
      return "project";
    default:
      return "organization";
  }
}

function getInvitationLabel(entityType: InvitationEntityType): string {
  switch (entityType) {
    case "organization":
      return "Organization Invitation";
    case "office":
      return "Office Invitation";
    case "project":
      return "Project Invitation";
    default:
      return "Workspace Invitation";
  }
}

/**
 * Invitation email sent when a user is invited to join an organization, office, or project
 */
export function InvitationEmail({
  inviteeEmail,
  inviterName,
  entityName,
  entityType,
  inviteUrl,
}: InvitationEmailProps) {
  const entityLabel = getEntityTypeLabel(entityType);
  const appName = getAppName();

  return (
    <BaseLayout
      preview={`${inviterName} invited you to join ${entityName} on ${appName}`}
      label={getInvitationLabel(entityType)}
      footer={`This invitation was sent to ${inviteeEmail}. If you weren't expecting it, you can safely ignore this email.`}
    >
      <EmailHeading>Join {entityName}</EmailHeading>

      <Paragraph>
        <strong style={strong}>{inviterName}</strong> has invited you to join
        the <strong style={strong}>{entityName}</strong> {entityLabel} on{" "}
        {preventAutoLink(appName)}.
      </Paragraph>

      <Paragraph>
        {preventAutoLink(appName)} brings AI-powered chat, task management and
        project coordination together in one place.
      </Paragraph>

      <CtaButton href={inviteUrl} label="Accept Invitation" />

      <FallbackUrl url={inviteUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
