import { Text } from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import {
  CardMascot,
  CtaButton,
  Disclaimer,
  FallbackUrl,
  GradientCard,
  GreetingPill,
} from "./email-card";

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
    >
      <GradientCard>
        <GreetingPill>Hello</GreetingPill>

        <Text style={inviteText}>
          <strong>{inviterName}</strong>
          <span style={inviteTextLight}> has invited you to join the </span>
          <strong>{entityName}</strong>
          <span style={inviteTextLight}>
            {" "}
            {entityLabel} on {preventAutoLink(appName)}
          </span>
        </Text>

        <Text style={descriptionText}>
          {preventAutoLink(appName)} helps teams collaborate more effectively
          with AI-powered chat, task management and project coordination. Join
          your team and start collaborating today!
        </Text>

        <CtaButton href={inviteUrl} label="Accept Invitation" />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This invitation was sent to {inviteeEmail}. If you weren't expecting
        this invitation, you can safely ignore this email.
      </Disclaimer>

      <FallbackUrl url={inviteUrl} />
    </BaseLayout>
  );
}

// Styles
const inviteText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const inviteTextLight = {
  color: "rgba(255, 255, 255, 0.8)",
};

const descriptionText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.8)",
  textAlign: "center" as const,
  margin: "0 0 36px",
};
