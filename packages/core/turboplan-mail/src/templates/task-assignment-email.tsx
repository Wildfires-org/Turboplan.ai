import { BaseLayout } from "./base-layout";
import {
  CtaButton,
  DetailItem,
  DetailsBox,
  DetailTitle,
  EmailHeading,
  FallbackUrl,
  Paragraph,
} from "./email-card";

export interface TaskAssignmentEmailProps {
  /** Email of the person being assigned */
  assigneeEmail: string;
  /** Name of the assignee (for personalization) */
  assigneeName?: string;
  /** Name of the person who made the assignment */
  assignerName: string;
  /** Name of the project */
  projectName: string;
  /** Task title */
  taskTitle: string;
  /** Optional milestone title if the task belongs to a milestone */
  milestoneTitle?: string;
  /** Optional task description */
  taskDescription?: string;
  /** URL to view the task */
  taskUrl: string;
}

/**
 * Task assignment notification email sent when an existing project member
 * is assigned to a task
 */
export function TaskAssignmentEmail({
  assigneeEmail,
  assigneeName,
  assignerName,
  projectName,
  taskTitle,
  milestoneTitle,
  taskDescription,
  taskUrl,
}: TaskAssignmentEmailProps) {
  return (
    <BaseLayout
      preview={`${assignerName} assigned you to "${taskTitle}" in ${projectName}`}
      label="Task Assignment"
      footer={`This notification was sent to ${assigneeEmail} because you are a member of the ${projectName} project.`}
    >
      <EmailHeading>
        {assigneeName
          ? `${assigneeName}, you have a new task`
          : "You have a new task"}
      </EmailHeading>

      <Paragraph>
        <strong style={strong}>{assignerName}</strong> has assigned you to a
        task in the <strong style={strong}>{projectName}</strong> project.
      </Paragraph>

      <DetailsBox>
        <DetailTitle>{taskTitle}</DetailTitle>
        {milestoneTitle && (
          <DetailItem label="Milestone">{milestoneTitle}</DetailItem>
        )}
        {taskDescription && (
          <DetailItem label="Description">{taskDescription}</DetailItem>
        )}
      </DetailsBox>

      <CtaButton href={taskUrl} label="View Task" />

      <FallbackUrl url={taskUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
