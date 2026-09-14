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
    >
      <GradientCard>
        <GreetingPill>
          {memberName ? `Hello, ${memberName}!` : "Hello"}
        </GreetingPill>

        <Text style={inviteText}>
          <strong>{inviterName}</strong>
          <span style={inviteTextLight}> has added you to the </span>
          <strong>{entityName}</strong>
          <span style={inviteTextLight}>
            {" "}
            {entityType} on {preventAutoLink(appName)}
          </span>
        </Text>

        <Text style={descriptionText}>
          You already have an account, so you're all set — jump right in.
        </Text>

        <CtaButton href={entityUrl} label={getOpenLabel(entityType)} />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This notification was sent to {memberEmail} because you were added to{" "}
        {entityName}.
      </Disclaimer>

      <FallbackUrl url={entityUrl} />
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
