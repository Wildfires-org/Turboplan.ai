import { Section, Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";
import {
  CardMascot,
  CtaButton,
  Disclaimer,
  FallbackUrl,
  GradientCard,
  GreetingPill,
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
  const greeting = assigneeName ? `Hello, ${assigneeName}!` : "Hello!";

  return (
    <BaseLayout
      preview={`${assignerName} assigned you to "${taskTitle}" in ${projectName}`}
      label="Task Assignment"
    >
      <GradientCard>
        <GreetingPill>{greeting}</GreetingPill>

        <Text style={assignmentText}>
          <strong>{assignerName}</strong>
          <span style={assignmentTextLight}>
            {" "}
            has assigned you to a task in the{" "}
          </span>
          <strong>{projectName}</strong>
          <span style={assignmentTextLight}> project.</span>
        </Text>

        {/* Task Details Box */}
        <Section style={taskDetailsBox}>
          <Text style={taskTitleStyle}>&#9745; {taskTitle}</Text>
          {milestoneTitle && (
            <Text style={taskDetailItem}>
              &#9632; Milestone: {milestoneTitle}
            </Text>
          )}
          {taskDescription && (
            <Text style={taskDescriptionStyle}>{taskDescription}</Text>
          )}
        </Section>

        <CtaButton href={taskUrl} label="View Task" />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This notification was sent to {assigneeEmail} because you are a member
        of the {projectName} project.
      </Disclaimer>

      <FallbackUrl url={taskUrl} />
    </BaseLayout>
  );
}

// Styles
const assignmentText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const assignmentTextLight = {
  color: "rgba(255, 255, 255, 0.8)",
};

const taskDetailsBox = {
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  padding: "16px",
  margin: "0 0 36px",
  textAlign: "left" as const,
};

const taskTitleStyle = {
  fontSize: "16px",
  fontWeight: "600" as const,
  lineHeight: "24px",
  color: "#ffffff",
  margin: "0 0 6px",
};

const taskDetailItem = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.9)",
  margin: "0 0 4px",
};

const taskDescriptionStyle = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.8)",
  margin: "8px 0 0",
  borderTop: "1px solid rgba(255, 255, 255, 0.2)",
  paddingTop: "8px",
};
