import { Section, Text } from "@react-email/components";

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

export interface ProjectInvitationEmailProps {
  /** Email of the person being invited */
  inviteeEmail: string;
  /** Name of the person who sent the invitation */
  inviterName: string;
  /** Name of the project */
  projectName: string;
  /** Role assigned to the invitee */
  role: string;
  /** Optional task title if assigned to a task */
  taskTitle?: string;
  /** Optional milestone title if assigned to a milestone */
  milestoneTitle?: string;
  /** URL to accept the invitation */
  inviteUrl: string;
}

/**
 * Format role for display (capitalize first letter)
 */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Project invitation email sent when a user is invited to join a project
 * with optional task/milestone assignment information
 */
export function ProjectInvitationEmail({
  inviteeEmail,
  inviterName,
  projectName,
  role,
  taskTitle,
  milestoneTitle,
  inviteUrl,
}: ProjectInvitationEmailProps) {
  const appName = getAppName();

  return (
    <BaseLayout
      preview={`${inviterName} invited you to join ${projectName} on ${appName}`}
      label="Project Invitation"
    >
      <GradientCard>
        <GreetingPill>Hello</GreetingPill>

        <Text style={inviteText}>
          <strong>{inviterName}</strong>
          <span style={inviteTextLight}> has invited you to join the </span>
          <strong>{projectName}</strong>
          <span style={inviteTextLight}>
            {" "}
            project on {preventAutoLink(appName)} as{" "}
          </span>
          <strong>{formatRole(role)}</strong>
        </Text>

        {(taskTitle || milestoneTitle) && (
          <Section style={assignmentSection}>
            <Text style={assignmentTitle}>You'll be assigned to:</Text>
            {taskTitle && (
              <Text style={assignmentItem}>
                &#9745; Task: <strong>{taskTitle}</strong>
              </Text>
            )}
            {milestoneTitle && (
              <Text style={assignmentItem}>
                &#9632; Milestone: <strong>{milestoneTitle}</strong>
              </Text>
            )}
          </Section>
        )}

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

const assignmentSection = {
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  padding: "16px",
  margin: "0 0 16px",
};

const assignmentTitle = {
  fontSize: "12px",
  fontWeight: "600" as const,
  color: "rgba(255, 255, 255, 0.9)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const assignmentItem = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#ffffff",
  margin: "0 0 4px",
  textAlign: "center" as const,
};

const descriptionText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.8)",
  textAlign: "center" as const,
  margin: "0 0 36px",
};
