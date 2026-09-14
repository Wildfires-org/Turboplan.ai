import { getAppName } from "@wildfires-org/turboplan-env";

import {
  DiscountEndingEmail,
  type DiscountEndingEmailProps,
  getEntityTypeLabel,
  InvitationEmail,
  type InvitationEmailProps,
  MagicLinkEmail,
  type MagicLinkEmailProps,
  MemberAddedEmail,
  type MemberAddedEmailProps,
  PaymentFailedEmail,
  type PaymentFailedEmailProps,
  ProjectInvitationEmail,
  type ProjectInvitationEmailProps,
  SigningRequestEmail,
  type SigningRequestEmailProps,
  SubmissionAcceptanceEmail,
  type SubmissionAcceptanceEmailProps,
  SubmissionRejectionEmail,
  type SubmissionRejectionEmailProps,
  TaskAssignmentEmail,
  type TaskAssignmentEmailProps,
  UsageAlertEmail,
  type UsageAlertEmailProps,
} from "../templates";
import type { MailProvider, SendEmailResult } from "../types";

/**
 * High-level mail service with convenience methods for common email types
 */
export class MailService {
  constructor(private provider: MailProvider) {}

  /**
   * Send an invitation email to join an organization, office, or project
   *
   * @example
   * ```typescript
   * await mailService.sendInvitationEmail({
   *   to: "invitee@example.com",
   *   inviteeEmail: "invitee@example.com",
   *   inviterName: "Jane Doe",
   *   entityName: "Q1 Planning",
   *   entityType: "project",
   *   inviteUrl: "https://app.your-domain.com/invite/abc123",
   * });
   * ```
   */
  async sendInvitationEmail(
    options: InvitationEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, inviteeEmail, inviterName, entityName, entityType, inviteUrl } =
      options;
    const entityLabel = getEntityTypeLabel(entityType);

    return this.provider.sendEmail({
      to,
      subject: `${inviterName} invited you to join ${entityName} ${entityLabel} on ${getAppName()}`,
      react: InvitationEmail({
        inviteeEmail,
        inviterName,
        entityName,
        entityType,
        inviteUrl,
      }),
    });
  }

  /**
   * Send a notification email to an existing user who was added directly to an
   * organization, office, or project.
   *
   * @example
   * ```typescript
   * await mailService.sendMemberAddedEmail({
   *   to: "member@example.com",
   *   memberEmail: "member@example.com",
   *   memberName: "John Doe",
   *   inviterName: "Jane Doe",
   *   entityName: "Q1 Planning",
   *   entityType: "project",
   *   entityUrl: "https://app.your-domain.com/organizations/acme/offices/hq/projects/q1-planning",
   * });
   * ```
   */
  async sendMemberAddedEmail(
    options: MemberAddedEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const {
      to,
      memberEmail,
      memberName,
      inviterName,
      entityName,
      entityType,
      entityUrl,
    } = options;

    return this.provider.sendEmail({
      to,
      subject: `You've been added to ${entityName} on ${getAppName()}`,
      react: MemberAddedEmail({
        memberEmail,
        memberName,
        inviterName,
        entityName,
        entityType,
        entityUrl,
      }),
    });
  }

  /**
   * Send a project invitation email with optional task/milestone assignment info
   *
   * @example
   * ```typescript
   * await mailService.sendProjectInvitationEmail({
   *   to: "invitee@example.com",
   *   inviteeEmail: "invitee@example.com",
   *   inviterName: "Jane Doe",
   *   projectName: "Q1 Planning",
   *   role: "editor",
   *   taskTitle: "Review budget proposal",
   *   inviteUrl: "https://app.your-domain.com/invite/abc123",
   * });
   * ```
   */
  async sendProjectInvitationEmail(
    options: ProjectInvitationEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const {
      to,
      inviteeEmail,
      inviterName,
      projectName,
      role,
      taskTitle,
      milestoneTitle,
      inviteUrl,
    } = options;

    // Build subject line with assignment info
    let subject = `${inviterName} invited you to join ${projectName} on ${getAppName()}`;
    if (taskTitle) {
      subject = `${inviterName} assigned you to "${taskTitle}" in ${projectName}`;
    } else if (milestoneTitle) {
      subject = `${inviterName} assigned you to "${milestoneTitle}" in ${projectName}`;
    }

    return this.provider.sendEmail({
      to,
      subject,
      react: ProjectInvitationEmail({
        inviteeEmail,
        inviterName,
        projectName,
        role,
        taskTitle,
        milestoneTitle,
        inviteUrl,
      }),
    });
  }

  /**
   * Send a task assignment notification email to an existing project member
   *
   * @example
   * ```typescript
   * await mailService.sendTaskAssignmentEmail({
   *   to: "assignee@example.com",
   *   assigneeEmail: "assignee@example.com",
   *   assigneeName: "John Doe",
   *   assignerName: "Jane Smith",
   *   projectName: "Q1 Planning",
   *   taskTitle: "Review budget proposal",
   *   milestoneTitle: "Budget Review",
   *   taskUrl: "https://app.your-domain.com/projects/123/tasks",
   * });
   * ```
   */
  async sendTaskAssignmentEmail(
    options: TaskAssignmentEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const {
      to,
      assigneeEmail,
      assigneeName,
      assignerName,
      projectName,
      taskTitle,
      milestoneTitle,
      taskDescription,
      taskUrl,
    } = options;

    const subject = `${assignerName} assigned you to "${taskTitle}" in ${projectName}`;

    return this.provider.sendEmail({
      to,
      subject,
      react: TaskAssignmentEmail({
        assigneeEmail,
        assigneeName,
        assignerName,
        projectName,
        taskTitle,
        milestoneTitle,
        taskDescription,
        taskUrl,
      }),
    });
  }

  /**
   * Send a magic link email for authentication
   *
   * @example
   * ```typescript
   * // For email verification (new user)
   * await mailService.sendMagicLinkEmail({
   *   to: "user@example.com",
   *   magicLinkUrl: "https://app.your-domain.com/verify?token=xxx",
   *   type: "verification",
   * });
   *
   * // For login (returning user)
   * await mailService.sendMagicLinkEmail({
   *   to: "user@example.com",
   *   magicLinkUrl: "https://app.your-domain.com/verify?token=xxx",
   *   type: "login",
   * });
   * ```
   */
  async sendMagicLinkEmail(
    options: MagicLinkEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, magicLinkUrl, type } = options;

    const subject =
      type === "verification"
        ? `Verify your email for ${getAppName()}`
        : `Sign in to ${getAppName()}`;

    return this.provider.sendEmail({
      to,
      subject,
      react: MagicLinkEmail({ magicLinkUrl, type }),
    });
  }

  /**
   * Send an email notifying a citizen that their submission was accepted
   * and converted into a project.
   */
  async sendSubmissionAcceptanceEmail(
    options: SubmissionAcceptanceEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, citizenEmail, projectName, organizationName, projectUrl } =
      options;

    return this.provider.sendEmail({
      to,
      subject: `Your submission "${projectName}" has been approved`,
      react: SubmissionAcceptanceEmail({
        citizenEmail,
        projectName,
        organizationName,
        projectUrl,
      }),
    });
  }

  /**
   * Send an email notifying a citizen that their submission was rejected.
   */
  async sendSubmissionRejectionEmail(
    options: SubmissionRejectionEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const {
      to,
      citizenEmail,
      projectName,
      organizationName,
      rejectionReason,
      submissionUrl,
    } = options;

    return this.provider.sendEmail({
      to,
      subject: `Update on your submission "${projectName}"`,
      react: SubmissionRejectionEmail({
        citizenEmail,
        projectName,
        organizationName,
        rejectionReason,
        submissionUrl,
      }),
    });
  }

  async sendSigningRequestEmail(
    options: SigningRequestEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const {
      to,
      recipientEmail,
      recipientName,
      requesterName,
      documentTitle,
      projectName,
      signingUrl,
    } = options;

    return this.provider.sendEmail({
      to,
      subject: `${requesterName} requested your signature on "${documentTitle}"`,
      react: SigningRequestEmail({
        recipientEmail,
        recipientName,
        requesterName,
        documentTitle,
        projectName,
        signingUrl,
      }),
    });
  }

  /**
   * Send a dunning email to an organization owner when a subscription invoice
   * payment fails. Reassures that Stripe retries automatically and links to
   * billing settings so they can update their payment method.
   *
   * @example
   * ```typescript
   * await mailService.sendPaymentFailedEmail({
   *   to: "owner@example.com",
   *   orgName: "Acme Planning",
   *   billingUrl: "https://app.your-domain.com/organizations/acme/settings/billing",
   *   recipientEmail: "owner@example.com",
   * });
   * ```
   */
  async sendPaymentFailedEmail(
    options: PaymentFailedEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, orgName, billingUrl, recipientEmail } = options;

    return this.provider.sendEmail({
      to,
      subject: `Payment failed for ${orgName}`,
      react: PaymentFailedEmail({ orgName, billingUrl, recipientEmail }),
    });
  }

  /**
   * Notify an organization owner that a subscription discount ends soon
   * (30/7 days before the first full-price renewal).
   */
  async sendDiscountEndingEmail(
    options: DiscountEndingEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, ...props } = options;

    return this.provider.sendEmail({
      to,
      subject: `${props.orgName}'s ${props.percentOff}% discount ends in ${props.daysLeft} ${props.daysLeft === 1 ? "day" : "days"}`,
      react: DiscountEndingEmail(props),
    });
  }

  /**
   * Send a credit usage alert to an organization owner when the monthly pool
   * crosses a catalog threshold (70/90/100%).
   */
  async sendUsageAlertEmail(
    options: UsageAlertEmailProps & { to: string },
  ): Promise<SendEmailResult> {
    const { to, ...props } = options;

    return this.provider.sendEmail({
      to,
      subject:
        props.percentage >= 100
          ? `${props.orgName} has used all of its monthly credits`
          : `${props.orgName} has used ${props.percentage}% of its monthly credits`,
      react: UsageAlertEmail(props),
    });
  }

  /**
   * Send a custom email using the underlying provider
   * Use this for one-off emails that don't have a dedicated method
   */
  async sendEmail(
    options: Parameters<MailProvider["sendEmail"]>[0],
  ): Promise<SendEmailResult> {
    return this.provider.sendEmail(options);
  }
}

/**
 * Factory function to create a MailService
 *
 * @example
 * ```typescript
 * import { createMailProvider, createMailService } from "@wildfires-org/turboplan-mail";
 *
 * const provider = createMailProvider("resend", {
 *   apiKey: env.RESEND_API_KEY,
 *   defaultFrom: "noreply@your-domain.com",
 * });
 *
 * const mailService = createMailService(provider);
 *
 * await mailService.sendMagicLinkEmail({
 *   to: "user@example.com",
 *   magicLinkUrl: "https://app.your-domain.com/verify?token=xxx",
 *   type: "verification",
 * });
 * ```
 */
export function createMailService(provider: MailProvider): MailService {
  return new MailService(provider);
}
