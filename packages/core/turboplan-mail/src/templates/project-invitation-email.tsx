import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import {
  CtaButton,
  DetailItem,
  DetailsBox,
  DetailTitle,
  EmailHeading,
  FallbackUrl,
  Paragraph,
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
      footer={`This invitation was sent to ${inviteeEmail}. If you weren't expecting it, you can safely ignore this email.`}
    >
      <EmailHeading>Join {projectName}</EmailHeading>

      <Paragraph>
        <strong style={strong}>{inviterName}</strong> has invited you to join
        the <strong style={strong}>{projectName}</strong> project on{" "}
        {preventAutoLink(appName)} as{" "}
        <strong style={strong}>{formatRole(role)}</strong>.
      </Paragraph>

      {(taskTitle || milestoneTitle) && (
        <DetailsBox>
          <DetailTitle>You'll be assigned to</DetailTitle>
          {taskTitle && <DetailItem label="Task">{taskTitle}</DetailItem>}
          {milestoneTitle && (
            <DetailItem label="Milestone">{milestoneTitle}</DetailItem>
          )}
        </DetailsBox>
      )}

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
