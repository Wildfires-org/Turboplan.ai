import { z } from "zod";

// Entity types that can have invitations
export const invitationEntityTypeSchema = z.enum([
  "organization",
  "office",
  "project",
]);

// Invitation roles
export const invitationRoleSchema = z.enum(["owner", "editor", "viewer"]);

// Schema for task/milestone assignment (optional, for project invitations)
export const taskAssignmentSchema = z
  .object({
    taskId: z.string().uuid("Invalid task ID").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID").optional(),
  })
  .optional();

// Schema for creating an invitation via API
export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: invitationRoleSchema,
  taskAssignment: taskAssignmentSchema,
});

// Schema for accepting an invitation
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// Schema for resending an invitation
export const resendInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation ID"),
});

// Schema for revoking an invitation
export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation ID"),
});
