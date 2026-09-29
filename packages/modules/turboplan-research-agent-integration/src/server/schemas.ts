import { z } from "zod";

import {
  HTTP_URL_ONLY_MESSAGE,
  isSafeHttpUrl,
} from "@wildfires-org/turboplan-utils/server";

// Base schemas (internal, used to compose exported schemas)

// Stored URLs are later opened as links, so only http(s) is accepted.
const httpUrlSchema = z
  .string()
  .url("Valid URL is required")
  .refine(isSafeHttpUrl, HTTP_URL_ONLY_MESSAGE);

const documentSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  url: httpUrlSchema,
  relevance: z.number().int().min(0).max(100),
  context: z.string().min(1, "Document context is required"),
  folder: z.string().max(255).optional(),
  folderDescription: z.string().max(255).optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  startDate: z.string().datetime("Valid start date is required"),
  dueDate: z.string().datetime("Valid due date is required"),
});

const milestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  startDate: z.string().datetime("Valid start date is required"),
  dueDate: z.string().datetime("Valid due date is required"),
  tasks: z
    .array(taskSchema)
    .max(100, "Maximum 100 tasks per milestone")
    .default([]),
});

const fieldSchema = z.object({
  label: z.string().min(1, "Field label is required"),
  value: z.string(),
});

const timelineItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  resourceUrls: z
    .array(
      z.object({
        url: httpUrlSchema,
        filename: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const contextItemSchema = z.object({
  label: z.string().min(1, "Context label is required"),
  content: z.string().min(1, "Context content is required"),
  url: httpUrlSchema.optional(),
});

const catalogOfficeSchema = z.object({
  name: z.string().min(1).max(100, "Office name max 100 chars"),
  description: z.string().optional(),
});

const catalogOrganizationSchema = z.object({
  name: z.string().min(1).max(100, "Organization name max 100 chars"),
  description: z.string().optional(),
  logoUrl: z.string().url("Valid logo URL required").optional(),
});

// Bootstrapper webhook schemas

export const bootstrapperAddDocumentsSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  documents: z.array(documentSchema).max(100, "Maximum 100 documents allowed"),
});

export const bootstrapperAddMilestonesSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  milestones: z.array(milestoneSchema).max(50, "Maximum 50 milestones allowed"),
});

export const bootstrapperAddFieldsSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  fields: z.array(fieldSchema).max(50, "Maximum 50 fields allowed"),
});

export const bootstrapperAddContextSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  context: z
    .array(contextItemSchema)
    .max(100, "Maximum 100 context items allowed"),
});

export const bootstrapperAddTimelineSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  timeline: z.array(timelineItemSchema).max(100, "Maximum 100 timeline items"),
});

// Cataloger webhook schemas

export const catalogerCreateEntrySchema = z.object({
  name: z.string().min(1).max(100, "Name max 100 chars"),
  description: z.string().optional(),
  coverImagePrompt: z.string().optional(),
  prompt: z.string().optional(),
  office: catalogOfficeSchema,
  organization: catalogOrganizationSchema,
  documents: z
    .array(documentSchema)
    .max(100, "Maximum 100 documents allowed")
    .default([]),
  milestones: z
    .array(milestoneSchema)
    .max(50, "Maximum 50 milestones allowed")
    .default([]),
  fields: z.array(fieldSchema).max(50, "Maximum 50 fields allowed").default([]),
  timeline: z
    .array(timelineItemSchema)
    .max(100, "Maximum 100 timeline items")
    .default([]),
  rawData: z.record(z.string(), z.unknown()).optional(),
});

// Proxy request schemas

export const catalogerRunRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(10_000, "Message max 10000 chars"),
});

// Webhook request schemas

export const bootstrapperProgressSchema = z.object({
  runId: z.string().min(1, "Run ID is required"),
  message: z.string().min(1, "Progress message is required"),
  step: z.string().optional(),
});

// Save-to-project schemas

export const saveToProjectSchema = z.object({
  itemIndices: z
    .array(z.number().int().min(0))
    .min(1, "At least one item index is required"),
});

export const saveMilestonesToProjectSchema = z.object({
  selections: z
    .array(
      z.object({
        milestoneIndex: z.number().int().min(0),
        taskIndices: z
          .array(z.number().int().min(0))
          .min(1, "At least one task index is required"),
      }),
    )
    .min(1, "At least one milestone selection is required"),
});
